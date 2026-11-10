import { desc, eq } from 'drizzle-orm'
import { Hono } from 'hono'
import { ulid } from 'ulid'

import { holdingInput } from '../../shared/schemas'
import type { Holding } from '../../shared/types'
import { holdings } from '../db/schema'
import { notFound, validate } from '../lib/http'
import { own } from '../lib/owned'
import type { AppEnv } from '../types'

type Row = typeof holdings.$inferSelect
const toDto = (h: Row): Holding => ({
  id: h.id,
  kind: h.kind,
  name: h.name,
  invested: h.invested,
  currentValue: h.currentValue,
  asOf: h.asOf,
  taxSection: h.taxSection,
  maturityOn: h.maturityOn,
})

export const holdingRoutes = new Hono<AppEnv>()
  .get('/', async (c) => {
    const { db, userId } = c.var
    const rows = await db
      .select()
      .from(holdings)
      .where(own(holdings, userId))
      .orderBy(desc(holdings.currentValue))
    return c.json(rows.map(toDto))
  })
  .post('/', validate('json', holdingInput), async (c) => {
    const { db, userId } = c.var
    const body = c.req.valid('json')
    const [row] = await db
      .insert(holdings)
      .values({
        ...body,
        taxSection: body.taxSection ?? null,
        maturityOn: body.maturityOn ?? null,
        id: ulid(),
        userId,
      })
      .returning()
    return c.json(toDto(row!), 201)
  })
  .patch('/:id', validate('json', holdingInput.partial()), async (c) => {
    const { db, userId } = c.var
    const [row] = await db
      .update(holdings)
      .set({ ...c.req.valid('json'), updatedAt: new Date() })
      .where(own(holdings, userId, eq(holdings.id, c.req.param('id'))))
      .returning()
    if (!row) throw notFound()
    return c.json(toDto(row))
  })
  .delete('/:id', async (c) => {
    const { db, userId } = c.var
    const res = await db
      .delete(holdings)
      .where(own(holdings, userId, eq(holdings.id, c.req.param('id'))))
      .returning({ id: holdings.id })
    if (!res.length) throw notFound()
    return c.body(null, 204)
  })
