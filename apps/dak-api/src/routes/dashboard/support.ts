import { ulid } from '@khata/dak-core'
import { and, desc, eq, gt, isNull } from 'drizzle-orm'
import { Hono } from 'hono'
import { z } from 'zod'

import type { AppEnv } from '../../app'
import { can } from '../../auth/permissions'
import { control } from '../../db'
import { HttpError } from '../../lib/errors'
import { validate } from '../../lib/validate'
import { requirePermission } from '../../middleware/session'
import { audit } from '../../services/audit'

/**
 * Support access is opt-in, time-limited, audited and visible to the customer (spec §4).
 * Body access needs its own flag and the granter must hold `emailBody:read` themselves.
 */
export const support = new Hono<AppEnv>()

const MAX_HOURS = 72

support.get('/', requirePermission({ audit: ['read'] }), async (c) => {
  const rows = await c.get('db').control.findMany(control.supportGrant, undefined, {
    orderBy: desc(control.supportGrant.id),
    limit: 50,
  })
  const now = Date.now()
  return c.json({
    data: rows.map((g) => ({ ...g, active: !g.revokedAt && g.expiresAt > now })),
  })
})

support.post(
  '/',
  requirePermission({ support: ['grant'] }),
  validate(
    'json',
    z.object({
      supportUserId: z.string().min(1),
      reason: z.string().trim().min(5).max(500),
      hours: z.number().int().min(1).max(MAX_HOURS),
      includeBodies: z.boolean().default(false),
    }),
  ),
  async (c) => {
    const body = c.req.valid('json')
    if (body.includeBodies) {
      if (!can(c.get('member')!.role, { emailBody: ['read'] })) {
        throw new HttpError(403, 'forbidden', 'Only members who can read bodies can share them.')
      }
    }
    const id = `spg_${ulid()}`
    const expiresAt = Date.now() + body.hours * 3_600_000
    await c.get('db').control.insert(control.supportGrant, {
      id,
      grantedBy: c.get('member')!.user.id,
      supportUserId: body.supportUserId,
      reason: body.reason,
      includeBodies: body.includeBodies,
      expiresAt,
    })
    await audit(c, {
      action: 'support.granted',
      targetType: 'support_grant',
      targetId: id,
      data: body,
    })
    return c.json({ id, expiresAt }, 201)
  },
)

support.delete('/:id', requirePermission({ support: ['grant'] }), async (c) => {
  const id = c.req.param('id')
  const db = c.get('db').control
  const t = control.supportGrant
  const grant = await db.findFirst(
    t,
    and(eq(t.id, id), isNull(t.revokedAt), gt(t.expiresAt, Date.now())),
  )
  if (!grant) throw new HttpError(404, 'not_found', 'No active grant with that ID.')
  await db.update(t, { revokedAt: Date.now() }, eq(t.id, id))
  await audit(c, { action: 'support.revoked', targetType: 'support_grant', targetId: id })
  return c.body(null, 204)
})
