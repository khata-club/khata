import { asc, eq } from 'drizzle-orm'
import { Hono } from 'hono'
import { ulid } from 'ulid'

import { categoryInput } from '../../shared/schemas'
import type { Category } from '../../shared/types'
import { categories } from '../db/schema'
import { notFound, validate } from '../lib/http'
import { own } from '../lib/owned'
import type { AppEnv } from '../types'

type Row = typeof categories.$inferSelect
const toDto = (r: Row): Category => ({
  id: r.id,
  kind: r.kind,
  name: r.name,
  icon: r.icon,
  color: r.color,
  isDefault: r.isDefault,
})

export const categoryRoutes = new Hono<AppEnv>()
  .get('/', async (c) => {
    const { db, userId } = c.var
    const rows = await db
      .select()
      .from(categories)
      .where(own(categories, userId))
      .orderBy(asc(categories.kind), asc(categories.createdAt), asc(categories.id))
    return c.json(rows.map(toDto))
  })
  .post('/', validate('json', categoryInput), async (c) => {
    const { db, userId } = c.var
    const [row] = await db
      .insert(categories)
      .values({ ...c.req.valid('json'), id: ulid(), userId })
      .returning()
    return c.json(toDto(row!), 201)
  })
  .patch('/:id', validate('json', categoryInput.partial()), async (c) => {
    const { db, userId } = c.var
    const [row] = await db
      .update(categories)
      .set({ ...c.req.valid('json'), updatedAt: new Date() })
      .where(own(categories, userId, eq(categories.id, c.req.param('id'))))
      .returning()
    if (!row) throw notFound()
    return c.json(toDto(row))
  })
  .delete('/:id', async (c) => {
    const { db, userId } = c.var
    const res = await db
      .delete(categories)
      .where(own(categories, userId, eq(categories.id, c.req.param('id'))))
      .returning({ id: categories.id })
    if (!res.length) throw notFound()
    return c.body(null, 204)
  })
