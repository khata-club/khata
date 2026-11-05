import { ApiScope, DEFAULT_SCOPES, keyPrefixFor, newId } from '@khata/dak-core'
import { and, desc, eq, isNull } from 'drizzle-orm'
import { Hono, type Context } from 'hono'
import { z } from 'zod'

import type { AppEnv } from '../../app'
import { control } from '../../db'
import { randomToken, sha256Hex } from '../../lib/crypto'
import { HttpError } from '../../lib/errors'
import { validate } from '../../lib/validate'
import { requirePermission } from '../../middleware/session'
import { audit } from '../../services/audit'

/** Mounted at /api/projects/:projectId/api-keys. */
export const apiKeys = new Hono<AppEnv>()

type Key = typeof control.apiKey.$inferSelect

function present(k: Key) {
  const rest: Partial<Key> = { ...k }
  delete rest.hash
  const status = k.revokedAt
    ? 'revoked'
    : k.expiresAt && k.expiresAt < Date.now()
      ? 'expired'
      : 'active'
  return { ...rest, status }
}

async function project(c: Context<AppEnv>) {
  const p = await c
    .get('db')
    .control.findFirst(control.project, eq(control.project.id, c.req.param('projectId')!))
  if (!p || p.archivedAt) throw new HttpError(404, 'not_found', 'Project not found.')
  return p
}

/** Issues a key: returns the full secret once; stores only its SHA-256 and a display prefix. */
async function issue(kind: 'production' | 'staging' | 'sandbox') {
  const secret = `${keyPrefixFor(kind)}${randomToken(24)}`
  return { secret, hash: await sha256Hex(secret), prefix: secret.slice(0, 13) }
}

apiKeys.get('/', requirePermission({ apiKey: ['read'] }), async (c) => {
  const p = await project(c)
  const rows = await c
    .get('db')
    .control.findMany(control.apiKey, eq(control.apiKey.projectId, p.id), {
      orderBy: desc(control.apiKey.id),
    })
  return c.json({ data: rows.map(present) })
})

const createKey = z.object({
  name: z.string().trim().min(1).max(80),
  environmentId: z.string(),
  scopes: z.array(ApiScope).min(1).default(DEFAULT_SCOPES),
  allowedDomains: z.array(z.string().toLowerCase()).max(50).default([]),
  expiresInDays: z.number().int().min(1).max(730).optional(),
})

apiKeys.post(
  '/',
  requirePermission({ apiKey: ['manage'] }),
  validate('json', createKey),
  async (c) => {
    const p = await project(c)
    const body = c.req.valid('json')
    const db = c.get('db').control
    const env = await db.findFirst(
      control.environment,
      and(eq(control.environment.id, body.environmentId), eq(control.environment.projectId, p.id)),
    )
    if (!env)
      throw new HttpError(422, 'invalid_environment', 'Environment not found in this project.')

    if (body.allowedDomains.length) {
      const domains = await db.findMany(control.domain, eq(control.domain.projectId, p.id))
      const known = new Set(domains.map((d) => d.name))
      const unknown = body.allowedDomains.filter((d) => !known.has(d))
      if (unknown.length) {
        throw new HttpError(422, 'unknown_domain', `Not in this project: ${unknown.join(', ')}`)
      }
    }

    const id = newId('apiKey')
    const { secret, hash, prefix } = await issue(env.kind)
    await db.insert(control.apiKey, {
      id,
      projectId: p.id,
      environmentId: env.id,
      name: body.name,
      prefix,
      hash,
      scopes: [...new Set(body.scopes)],
      allowedDomains: body.allowedDomains,
      createdBy: c.get('member')!.user.id,
      expiresAt: body.expiresInDays ? Date.now() + body.expiresInDays * 86_400_000 : null,
    })
    await audit(c, {
      action: 'api_key.created',
      targetType: 'api_key',
      targetId: id,
      data: { name: body.name, environmentId: env.id, scopes: body.scopes },
    })
    return c.json({ id, key: secret, prefix }, 201)
  },
)

async function activeKey(c: Context<AppEnv>, projectId: string) {
  const k = await c
    .get('db')
    .control.findFirst(
      control.apiKey,
      and(
        eq(control.apiKey.id, c.req.param('keyId')!),
        eq(control.apiKey.projectId, projectId),
        isNull(control.apiKey.revokedAt),
      ),
    )
  if (!k) throw new HttpError(404, 'not_found', 'No active key with that ID.')
  return k
}

apiKeys.delete('/:keyId', requirePermission({ apiKey: ['manage'] }), async (c) => {
  const p = await project(c)
  const k = await activeKey(c, p.id)
  await c
    .get('db')
    .control.update(control.apiKey, { revokedAt: Date.now() }, eq(control.apiKey.id, k.id))
  await audit(c, { action: 'api_key.revoked', targetType: 'api_key', targetId: k.id })
  return c.body(null, 204)
})

/** Roll: issue a replacement with the same settings and revoke the old key immediately. */
apiKeys.post('/:keyId/roll', requirePermission({ apiKey: ['manage'] }), async (c) => {
  const p = await project(c)
  const old = await activeKey(c, p.id)
  const db = c.get('db').control
  const env = await db.findFirst(control.environment, eq(control.environment.id, old.environmentId))
  const id = newId('apiKey')
  const { secret, hash, prefix } = await issue(env?.kind ?? 'production')
  await db.db.batch([
    db.insert(control.apiKey, {
      id,
      projectId: p.id,
      environmentId: old.environmentId,
      name: old.name,
      prefix,
      hash,
      scopes: old.scopes,
      allowedDomains: old.allowedDomains,
      createdBy: c.get('member')!.user.id,
      expiresAt: old.expiresAt,
    }),
    db.update(control.apiKey, { revokedAt: Date.now() }, eq(control.apiKey.id, old.id)),
  ])
  await audit(c, {
    action: 'api_key.rolled',
    targetType: 'api_key',
    targetId: id,
    data: { replaced: old.id },
  })
  return c.json({ id, key: secret, prefix }, 201)
})
