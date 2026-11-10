import { asc, eq } from 'drizzle-orm'
import { Hono } from 'hono'
import { ulid } from 'ulid'

import { accountInput } from '../../shared/schemas'
import type { Account } from '../../shared/types'
import { accounts } from '../db/schema'
import { accountBalances } from '../lib/balances'
import { notFound, validate } from '../lib/http'
import { own } from '../lib/owned'
import type { AppEnv } from '../types'

type Row = typeof accounts.$inferSelect

const toDto = (a: Row, balance: number): Account => ({
  id: a.id,
  type: a.type,
  name: a.name,
  institution: a.institution,
  openingBalance: a.openingBalance,
  creditLimit: a.creditLimit,
  dueDay: a.dueDay,
  color: a.color,
  last4: a.last4,
  archived: a.archived,
  balance,
})

export const accountRoutes = new Hono<AppEnv>()
  .get('/', async (c) => {
    const { db, userId } = c.var
    const [rows, balances] = await Promise.all([
      db
        .select()
        .from(accounts)
        .where(own(accounts, userId))
        .orderBy(accounts.archived, asc(accounts.createdAt), asc(accounts.id)),
      accountBalances(db, userId),
    ])
    return c.json(rows.map((a) => toDto(a, balances.get(a.id) ?? a.openingBalance)))
  })
  .post('/', validate('json', accountInput), async (c) => {
    const { db, userId } = c.var
    const body = c.req.valid('json')
    const [row] = await db
      .insert(accounts)
      .values({ ...body, id: ulid(), userId, archived: body.archived ?? false })
      .returning()
    return c.json(toDto(row!, row!.openingBalance), 201)
  })
  .patch('/:id', validate('json', accountInput.partial()), async (c) => {
    const { db, userId } = c.var
    const body = c.req.valid('json')
    const [row] = await db
      .update(accounts)
      .set({ ...body, updatedAt: new Date() })
      .where(own(accounts, userId, eq(accounts.id, c.req.param('id'))))
      .returning()
    if (!row) throw notFound()
    const balances = await accountBalances(db, userId)
    return c.json(toDto(row, balances.get(row.id) ?? row.openingBalance))
  })
  .delete('/:id', async (c) => {
    const { db, userId } = c.var
    const res = await db
      .delete(accounts)
      .where(own(accounts, userId, eq(accounts.id, c.req.param('id'))))
      .returning({ id: accounts.id })
    if (!res.length) throw notFound()
    return c.body(null, 204)
  })
