import { eq, gte, lte, sql } from 'drizzle-orm'
import { Hono } from 'hono'
import { ulid } from 'ulid'
import { z } from 'zod'

import { monthBounds } from '../../shared/dates'
import { budgetCopyInput, budgetInput, month } from '../../shared/schemas'
import type { Budget } from '../../shared/types'
import type { DB } from '../db'
import { budgets, transactions } from '../db/schema'
import { validate } from '../lib/http'
import { assertRefs, own } from '../lib/owned'
import type { AppEnv } from '../types'

/** Budgets for a month, each with what was spent in its category that month. */
export async function budgetsWithSpent(db: DB, userId: string, m: string): Promise<Budget[]> {
  const { start, end } = monthBounds(m)
  const [rows, spent] = await Promise.all([
    db
      .select()
      .from(budgets)
      .where(own(budgets, userId, eq(budgets.month, m))),
    db
      .select({
        categoryId: transactions.categoryId,
        total: sql<number>`sum(${transactions.amount})`,
      })
      .from(transactions)
      .where(
        own(
          transactions,
          userId,
          eq(transactions.type, 'expense'),
          gte(transactions.occurredOn, start),
          lte(transactions.occurredOn, end),
        ),
      )
      .groupBy(transactions.categoryId),
  ])
  const byCat = new Map(spent.map((s) => [s.categoryId, Number(s.total)]))
  return rows.map((b) => ({
    id: b.id,
    month: b.month,
    categoryId: b.categoryId,
    limit: b.limit,
    spent: byCat.get(b.categoryId) ?? 0,
  }))
}

export const budgetRoutes = new Hono<AppEnv>()
  .get('/', validate('query', z.object({ month })), async (c) => {
    return c.json(await budgetsWithSpent(c.var.db, c.var.userId, c.req.valid('query').month))
  })
  /** Upsert one category's limit; a limit of 0 removes the budget. */
  .put('/', validate('json', budgetInput), async (c) => {
    const { db, userId } = c.var
    const b = c.req.valid('json')
    await assertRefs(db, userId, { categoryId: b.categoryId })
    if (b.limit === 0) {
      await db
        .delete(budgets)
        .where(
          own(budgets, userId, eq(budgets.month, b.month), eq(budgets.categoryId, b.categoryId)),
        )
    } else {
      await db
        .insert(budgets)
        .values({ id: ulid(), userId, month: b.month, categoryId: b.categoryId, limit: b.limit })
        .onConflictDoUpdate({
          target: [budgets.userId, budgets.month, budgets.categoryId],
          set: { limit: b.limit, updatedAt: new Date() },
        })
    }
    return c.json(await budgetsWithSpent(db, userId, b.month))
  })
  /** Copy every limit from one month into another (existing limits there are kept). */
  .post('/copy', validate('json', budgetCopyInput), async (c) => {
    const { db, userId } = c.var
    const { from, to } = c.req.valid('json')
    // One INSERT … SELECT; existing limits in the target month win.
    await c.env.DB.prepare(
      `INSERT OR IGNORE INTO fin_budgets (id, user_id, month, category_id, limit_amount)
       SELECT lower(hex(randomblob(13))), user_id, ?3, category_id, limit_amount
       FROM fin_budgets WHERE user_id = ?1 AND month = ?2`,
    )
      .bind(userId, from, to)
      .run()
    return c.json(await budgetsWithSpent(db, userId, to))
  })
