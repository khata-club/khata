import { and, desc, eq, gte, like, lt, lte, or, type SQL } from 'drizzle-orm'
import { Hono } from 'hono'
import { ulid } from 'ulid'

import { monthBounds } from '../../shared/dates'
import { transactionInput, transactionQuery } from '../../shared/schemas'
import type { Transaction, TransactionPage } from '../../shared/types'
import type { DB } from '../db'
import { transactions } from '../db/schema'
import { badRequest, notFound, validate } from '../lib/http'
import { assertRefs, own } from '../lib/owned'
import type { AppEnv } from '../types'

type Row = typeof transactions.$inferSelect
export const txnDto = (r: Row): Transaction => ({
  id: r.id,
  type: r.type,
  amount: r.amount,
  occurredOn: r.occurredOn,
  accountId: r.accountId,
  toAccountId: r.toAccountId,
  categoryId: r.categoryId,
  paymentMode: r.paymentMode,
  payee: r.payee,
  note: r.note,
  taxSection: r.taxSection,
  recurringId: r.recurringId,
})

/** Normalise a validated input so transfers never carry a category and vice versa. */
function normalise(body: ReturnType<typeof transactionInput.parse>) {
  const transfer = body.type === 'transfer'
  return {
    ...body,
    toAccountId: transfer ? (body.toAccountId ?? null) : null,
    categoryId: transfer ? null : (body.categoryId ?? null),
    paymentMode: body.paymentMode ?? null,
    taxSection: body.type === 'income' ? null : (body.taxSection ?? null),
  }
}

export function txnFilters(userId: string, q: ReturnType<typeof transactionQuery.parse>): SQL {
  const conds: (SQL | undefined)[] = []
  if (q.month) {
    const b = monthBounds(q.month)
    conds.push(gte(transactions.occurredOn, b.start), lte(transactions.occurredOn, b.end))
  }
  if (q.from) conds.push(gte(transactions.occurredOn, q.from))
  if (q.to) conds.push(lte(transactions.occurredOn, q.to))
  if (q.accountId)
    conds.push(
      or(eq(transactions.accountId, q.accountId), eq(transactions.toAccountId, q.accountId)),
    )
  if (q.categoryId) conds.push(eq(transactions.categoryId, q.categoryId))
  if (q.type) conds.push(eq(transactions.type, q.type))
  if (q.paymentMode) conds.push(eq(transactions.paymentMode, q.paymentMode))
  if (q.q) {
    const pat = `%${q.q.replace(/[%_]/g, '')}%`
    conds.push(or(like(transactions.payee, pat), like(transactions.note, pat)))
  }
  return own(transactions, userId, ...conds)
}

async function getOwned(db: DB, userId: string, id: string) {
  const [row] = await db
    .select()
    .from(transactions)
    .where(own(transactions, userId, eq(transactions.id, id)))
  if (!row) throw notFound()
  return row
}

export const transactionRoutes = new Hono<AppEnv>()
  .get('/', validate('query', transactionQuery), async (c) => {
    const { db, userId } = c.var
    const q = c.req.valid('query')
    let where = txnFilters(userId, q)
    if (q.cursor) {
      const [date, id] = q.cursor.split('|')
      if (!date || !id) throw badRequest('Bad cursor')
      where = and(
        where,
        or(
          lt(transactions.occurredOn, date),
          and(eq(transactions.occurredOn, date), lt(transactions.id, id)),
        ),
      )!
    }
    const rows = await db
      .select()
      .from(transactions)
      .where(where)
      .orderBy(desc(transactions.occurredOn), desc(transactions.id))
      .limit(q.limit + 1)
    const page = rows.slice(0, q.limit)
    const last = page[page.length - 1]
    const body: TransactionPage = {
      items: page.map(txnDto),
      nextCursor: rows.length > q.limit && last ? `${last.occurredOn}|${last.id}` : null,
    }
    return c.json(body)
  })
  .get('/:id', async (c) =>
    c.json(txnDto(await getOwned(c.var.db, c.var.userId, c.req.param('id')))),
  )
  .post('/', validate('json', transactionInput), async (c) => {
    const { db, userId } = c.var
    const body = normalise(c.req.valid('json'))
    await assertRefs(db, userId, {
      accountIds: [body.accountId, body.toAccountId],
      categoryId: body.categoryId,
    })
    const [row] = await db
      .insert(transactions)
      .values({ ...body, id: ulid(), userId })
      .returning()
    return c.json(txnDto(row!), 201)
  })
  .put('/:id', validate('json', transactionInput), async (c) => {
    const { db, userId } = c.var
    const id = c.req.param('id')
    await getOwned(db, userId, id)
    const body = normalise(c.req.valid('json'))
    await assertRefs(db, userId, {
      accountIds: [body.accountId, body.toAccountId],
      categoryId: body.categoryId,
    })
    const [row] = await db
      .update(transactions)
      .set({ ...body, updatedAt: new Date() })
      .where(own(transactions, userId, eq(transactions.id, id)))
      .returning()
    return c.json(txnDto(row!))
  })
  .delete('/:id', async (c) => {
    const { db, userId } = c.var
    const res = await db
      .delete(transactions)
      .where(own(transactions, userId, eq(transactions.id, c.req.param('id'))))
      .returning({ id: transactions.id })
    if (!res.length) throw notFound()
    return c.body(null, 204)
  })
