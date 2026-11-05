import { desc, lt } from 'drizzle-orm'
import { Hono } from 'hono'
import { z } from 'zod'

import type { AppEnv } from '../../app'
import { control } from '../../db'
import { validate } from '../../lib/validate'
import { requirePermission } from '../../middleware/session'

export const audit = new Hono<AppEnv>()

audit.get(
  '/',
  requirePermission({ audit: ['read'] }),
  validate(
    'query',
    z.object({
      before: z.string().optional(),
      limit: z.coerce.number().int().min(1).max(200).default(50),
    }),
  ),
  async (c) => {
    const { before, limit } = c.req.valid('query')
    const t = control.auditEvent
    // IDs are ULIDs: newest first by ID, cursor = last ID of the page.
    const page = await c.get('db').control.findMany(t, before ? lt(t.id, before) : undefined, {
      orderBy: desc(t.id),
      limit: limit + 1,
    })
    return c.json({
      data: page.slice(0, limit),
      nextCursor: page.length > limit ? page[limit - 1]!.id : null,
    })
  },
)
