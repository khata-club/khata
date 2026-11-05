import { newId } from '@khata/dak-core'
import { and, eq } from 'drizzle-orm'
import { Hono, type Context } from 'hono'
import { z } from 'zod'

import type { AppEnv } from '../../app'
import { control } from '../../db'
import { normalizeDomain } from '../../domains/records'
import { createDomain, deleteDomain, refreshDomain } from '../../domains/service'
import { HttpError } from '../../lib/errors'
import { validate } from '../../lib/validate'
import { requirePermission } from '../../middleware/session'
import { audit } from '../../services/audit'

/** Mounted at /api/projects/:projectId/domains. */
export const domains = new Hono<AppEnv>()

async function project(c: Context<AppEnv>) {
  const id = c.req.param('projectId')!
  const p = await c.get('db').control.findFirst(control.project, eq(control.project.id, id))
  if (!p || p.archivedAt) throw new HttpError(404, 'not_found', 'Project not found.')
  return p
}

async function domain(c: Context<AppEnv>, projectId: string) {
  const d = await c
    .get('db')
    .control.findFirst(
      control.domain,
      and(eq(control.domain.id, c.req.param('domainId')!), eq(control.domain.projectId, projectId)),
    )
  if (!d) throw new HttpError(404, 'not_found', 'Domain not found.')
  return d
}

domains.get('/', requirePermission({ domain: ['read'] }), async (c) => {
  const p = await project(c)
  const db = c.get('db').control
  const [rows, senders] = await Promise.all([
    db.findMany(control.domain, eq(control.domain.projectId, p.id), {
      orderBy: control.domain.name,
    }),
    db.findMany(control.sender, eq(control.sender.projectId, p.id)),
  ])
  return c.json({
    data: rows.map((d) => ({ ...d, senders: senders.filter((s) => s.domainId === d.id) })),
  })
})

domains.post(
  '/',
  requirePermission({ domain: ['manage'] }),
  validate('json', z.object({ name: z.string() })),
  async (c) => {
    const p = await project(c)
    const name = normalizeDomain(c.req.valid('json').name)
    if (!name) throw new HttpError(422, 'invalid_domain', 'Enter a domain such as example.com.')
    const id = await createDomain(c.env, c.get('db').control, p, name)
    await audit(c, { action: 'domain.created', targetType: 'domain', targetId: id, data: { name } })
    return c.json({ id, name }, 201)
  },
)

domains.get('/:domainId', requirePermission({ domain: ['read'] }), async (c) => {
  const p = await project(c)
  return c.json(await domain(c, p.id))
})

domains.post('/:domainId/verify', requirePermission({ domain: ['read'] }), async (c) => {
  const p = await project(c)
  const d = await domain(c, p.id)
  const check = await refreshDomain(c.env, c.get('db').control, p, d)
  if (check.status === 'verified' && d.status !== 'verified') {
    await audit(c, { action: 'domain.verified', targetType: 'domain', targetId: d.id })
  }
  return c.json({ id: d.id, ...check })
})

domains.delete('/:domainId', requirePermission({ domain: ['manage'] }), async (c) => {
  const p = await project(c)
  const d = await domain(c, p.id)
  await deleteDomain(c.env, c.get('db').control, p, d)
  await audit(c, {
    action: 'domain.deleted',
    targetType: 'domain',
    targetId: d.id,
    data: { name: d.name },
  })
  return c.body(null, 204)
})

domains.post(
  '/:domainId/senders',
  requirePermission({ domain: ['manage'] }),
  validate(
    'json',
    z.object({ email: z.email(), displayName: z.string().trim().max(120).optional() }),
  ),
  async (c) => {
    const p = await project(c)
    const d = await domain(c, p.id)
    const body = c.req.valid('json')
    const email = body.email.toLowerCase()
    const host = email.split('@')[1]!
    if (host !== d.name && !host.endsWith(`.${d.name}`)) {
      throw new HttpError(422, 'sender_domain_mismatch', `Sender must be an address at ${d.name}.`)
    }
    const id = newId('sender')
    try {
      await c.get('db').control.insert(control.sender, {
        id,
        projectId: p.id,
        domainId: d.id,
        email,
        displayName: body.displayName ?? null,
      })
    } catch {
      throw new HttpError(409, 'conflict', 'That sender already exists.')
    }
    await audit(c, {
      action: 'sender.created',
      targetType: 'sender',
      targetId: id,
      data: { email },
    })
    return c.json({ id, email }, 201)
  },
)

domains.delete(
  '/:domainId/senders/:senderId',
  requirePermission({ domain: ['manage'] }),
  async (c) => {
    const p = await project(c)
    const d = await domain(c, p.id)
    await c
      .get('db')
      .control.delete(
        control.sender,
        and(eq(control.sender.id, c.req.param('senderId')), eq(control.sender.domainId, d.id)),
      )
    return c.body(null, 204)
  },
)
