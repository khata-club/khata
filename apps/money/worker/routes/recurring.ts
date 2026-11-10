import { asc, eq, sql } from 'drizzle-orm'
import { Hono } from 'hono'
import { ulid } from 'ulid'

import { todayIST } from '../../shared/dates'
import { outstandingAfter } from '../../shared/loans'
import { nextDueDate } from '../../shared/plan'
import { payRecurringInput, recurringInput } from '../../shared/schemas'
import type { Recurring } from '../../shared/types'
import type { DB } from '../db'
import { holdings, recurring, transactions } from '../db/schema'
import { notFound, validate } from '../lib/http'
import { assertRefs, own } from '../lib/owned'
import type { AppEnv } from '../types'
import { txnDto } from './transactions'

type Row = typeof recurring.$inferSelect

export const recurringDto = (r: Row): Recurring => {
  const ratePct = r.loanRateBps == null ? null : r.loanRateBps / 100
  return {
    id: r.id,
    kind: r.kind,
    name: r.name,
    amount: r.amount,
    frequency: r.frequency,
    nextDueOn: r.nextDueOn,
    accountId: r.accountId,
    categoryId: r.categoryId,
    paymentMode: r.paymentMode,
    taxSection: r.taxSection,
    holdingId: r.holdingId,
    loanPrincipal: r.loanPrincipal,
    loanRatePct: ratePct,
    loanTenureMonths: r.loanTenureMonths,
    paidCount: r.paidCount,
    active: r.active,
    outstanding:
      r.kind === 'emi' && r.loanPrincipal != null && ratePct != null && r.loanTenureMonths
        ? outstandingAfter(r.loanPrincipal, ratePct, r.loanTenureMonths, r.paidCount)
        : null,
  }
}

function toColumns(body: ReturnType<typeof recurringInput.parse>) {
  const { loanRatePct, ...rest } = body
  const emi = body.kind === 'emi'
  return {
    ...rest,
    anchorDay: Number(body.nextDueOn.slice(8, 10)),
    categoryId: body.categoryId ?? null,
    paymentMode: body.paymentMode ?? null,
    taxSection: body.taxSection ?? null,
    holdingId: body.kind === 'sip' ? (body.holdingId ?? null) : null,
    loanPrincipal: emi ? (body.loanPrincipal ?? null) : null,
    loanRateBps: emi && loanRatePct != null ? Math.round(loanRatePct * 100) : null,
    loanTenureMonths: emi ? (body.loanTenureMonths ?? null) : null,
  }
}

async function getOwned(db: DB, userId: string, id: string) {
  const [row] = await db
    .select()
    .from(recurring)
    .where(own(recurring, userId, eq(recurring.id, id)))
  if (!row) throw notFound()
  return row
}

export const recurringRoutes = new Hono<AppEnv>()
  .get('/', async (c) => {
    const { db, userId } = c.var
    const rows = await db
      .select()
      .from(recurring)
      .where(own(recurring, userId))
      .orderBy(asc(recurring.nextDueOn))
    return c.json(rows.map(recurringDto))
  })
  .post('/', validate('json', recurringInput), async (c) => {
    const { db, userId } = c.var
    const body = c.req.valid('json')
    await assertRefs(db, userId, {
      accountIds: [body.accountId],
      categoryId: body.categoryId,
      holdingId: body.holdingId,
    })
    const [row] = await db
      .insert(recurring)
      .values({ ...toColumns(body), id: ulid(), userId })
      .returning()
    return c.json(recurringDto(row!), 201)
  })
  .put('/:id', validate('json', recurringInput), async (c) => {
    const { db, userId } = c.var
    const id = c.req.param('id')
    await getOwned(db, userId, id)
    const body = c.req.valid('json')
    await assertRefs(db, userId, {
      accountIds: [body.accountId],
      categoryId: body.categoryId,
      holdingId: body.holdingId,
    })
    const [row] = await db
      .update(recurring)
      .set({ ...toColumns(body), updatedAt: new Date() })
      .where(own(recurring, userId, eq(recurring.id, id)))
      .returning()
    return c.json(recurringDto(row!))
  })
  .delete('/:id', async (c) => {
    const { db, userId } = c.var
    const res = await db
      .delete(recurring)
      .where(own(recurring, userId, eq(recurring.id, c.req.param('id'))))
      .returning({ id: recurring.id })
    if (!res.length) throw notFound()
    return c.body(null, 204)
  })
  /**
   * Mark the current instalment paid: logs the expense, advances the due date, bumps the
   * EMI count (closing the loan on the last one) and grows a linked SIP holding — atomically.
   */
  .post('/:id/pay', validate('json', payRecurringInput), async (c) => {
    const { db, userId } = c.var
    const r = await getOwned(c.var.db, userId, c.req.param('id'))
    const { paidOn = todayIST(), amount = r.amount } = c.req.valid('json')
    const paidCount = r.paidCount + 1
    const finished =
      r.kind === 'emi' && r.loanTenureMonths != null && paidCount >= r.loanTenureMonths
    const txnId = ulid()
    const ops = [
      db.insert(transactions).values({
        id: txnId,
        userId,
        type: 'expense',
        amount,
        occurredOn: paidOn,
        accountId: r.accountId,
        categoryId: r.categoryId,
        paymentMode: r.paymentMode ?? 'auto_debit',
        payee: r.name,
        taxSection: r.taxSection,
        recurringId: r.id,
      }),
      db
        .update(recurring)
        .set({
          paidCount,
          nextDueOn: nextDueDate(r.nextDueOn, r.frequency, r.anchorDay),
          active: finished ? false : r.active,
          updatedAt: new Date(),
        })
        .where(own(recurring, userId, eq(recurring.id, r.id))),
    ] as const
    if (r.kind === 'sip' && r.holdingId) {
      await db.batch([
        ...ops,
        db
          .update(holdings)
          .set({
            invested: sql`${holdings.invested} + ${amount}`,
            currentValue: sql`${holdings.currentValue} + ${amount}`,
            asOf: paidOn,
            updatedAt: new Date(),
          })
          .where(own(holdings, userId, eq(holdings.id, r.holdingId))),
      ])
    } else {
      await db.batch(ops)
    }
    const [txn] = await db.select().from(transactions).where(eq(transactions.id, txnId))
    const updated = await getOwned(db, userId, r.id)
    return c.json({ recurring: recurringDto(updated), transaction: txnDto(txn!) })
  })
