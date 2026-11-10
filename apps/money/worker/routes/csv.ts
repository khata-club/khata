import { desc, eq } from 'drizzle-orm'
import { Hono } from 'hono'
import { ulid } from 'ulid'

import { PAYMENT_MODE_LABEL } from '../../shared/constants'
import { importInput, transactionQuery } from '../../shared/schemas'
import type { ImportResult } from '../../shared/types'
import { accounts, categories, transactions } from '../db/schema'
import { validate } from '../lib/http'
import { assertRefs, own } from '../lib/owned'
import type { AppEnv } from '../types'
import { txnFilters } from './transactions'

const cell = (v: string | number | null | undefined) => {
  const s = v == null ? '' : String(v)
  // Quote, and neutralise spreadsheet formula injection.
  const safe = /^[=+\-@\t\r]/.test(s) && !/^-?\d/.test(s) ? `'${s}` : s
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe
}

export const csvRoutes = new Hono<AppEnv>()
  .get(
    '/export.csv',
    validate('query', transactionQuery.omit({ cursor: true, limit: true })),
    async (c) => {
      const { db, userId } = c.var
      const q = c.req.valid('query')
      const [rows, accs, cats] = await Promise.all([
        db
          .select()
          .from(transactions)
          .where(txnFilters(userId, { ...q, limit: 1 }))
          .orderBy(desc(transactions.occurredOn), desc(transactions.id)),
        db
          .select({ id: accounts.id, name: accounts.name })
          .from(accounts)
          .where(own(accounts, userId)),
        db
          .select({ id: categories.id, name: categories.name })
          .from(categories)
          .where(own(categories, userId)),
      ])
      const accName = new Map(accs.map((a) => [a.id, a.name]))
      const catName = new Map(cats.map((x) => [x.id, x.name]))
      const header = [
        'Date',
        'Type',
        'Amount (INR)',
        'Account',
        'To account',
        'Category',
        'Payment mode',
        'Payee',
        'Note',
        'Tax section',
      ]
      const lines = [header.join(',')]
      for (const t of rows) {
        lines.push(
          [
            t.occurredOn,
            t.type,
            (t.amount / 100).toFixed(2),
            accName.get(t.accountId),
            t.toAccountId ? accName.get(t.toAccountId) : '',
            t.categoryId ? catName.get(t.categoryId) : '',
            t.paymentMode ? PAYMENT_MODE_LABEL[t.paymentMode] : '',
            t.payee,
            t.note,
            t.taxSection,
          ]
            .map(cell)
            .join(','),
        )
      }
      return c.body('﻿' + lines.join('\r\n') + '\r\n', 200, {
        'content-type': 'text/csv; charset=utf-8',
        'content-disposition': `attachment; filename="khata-money-${q.month ?? 'all'}.csv"`,
        'x-row-count': String(rows.length),
      })
    },
  )
  /**
   * Import parsed CSV rows into one account. Unknown category names are created; rows that
   * match an existing entry (same date, amount and payee) are skipped as duplicates.
   * Inserts go through json_each so a 1000-row import is a single D1 statement.
   */
  .post('/import', validate('json', importInput), async (c) => {
    const { db, userId } = c.var
    const { accountId, rows } = c.req.valid('json')
    await assertRefs(db, userId, { accountIds: [accountId] })

    const cats = await db.select().from(categories).where(own(categories, userId))
    const key = (kind: string, name: string) => `${kind}:${name.trim().toLowerCase()}`
    const catByName = new Map(cats.map((x) => [key(x.kind, x.name), x.id]))
    const fallback = {
      expense: cats.find((x) => x.kind === 'expense' && x.name === 'Other')?.id ?? null,
      income: cats.find((x) => x.kind === 'income' && x.name === 'Other income')?.id ?? null,
    }
    const newCats: { id: string; kind: string; name: string }[] = []
    for (const r of rows) {
      if (!r.category) continue
      const k = key(r.type, r.category)
      if (!catByName.has(k)) {
        const id = ulid()
        catByName.set(k, id)
        newCats.push({ id, kind: r.type, name: r.category.trim().slice(0, 80) })
      }
    }

    const dates = rows.map((r) => r.occurredOn).sort()
    const existing = await db
      .select({
        occurredOn: transactions.occurredOn,
        amount: transactions.amount,
        payee: transactions.payee,
      })
      .from(transactions)
      .where(own(transactions, userId, eq(transactions.accountId, accountId)))
    const sig = (d: string, a: number, p: string | null | undefined) =>
      `${d}|${a}|${(p ?? '').trim().toLowerCase()}`
    const seen = new Set(
      existing
        .filter((e) => e.occurredOn >= dates[0]! && e.occurredOn <= dates[dates.length - 1]!)
        .map((e) => sig(e.occurredOn, e.amount, e.payee)),
    )
    const toInsert = []
    let duplicates = 0
    for (const r of rows) {
      const s = sig(r.occurredOn, r.amount, r.payee)
      if (seen.has(s)) {
        duplicates++
        continue
      }
      seen.add(s)
      toInsert.push({
        id: ulid(),
        type: r.type,
        amount: r.amount,
        occurredOn: r.occurredOn,
        categoryId: r.category ? catByName.get(key(r.type, r.category)) : fallback[r.type],
        paymentMode: r.paymentMode ?? null,
        payee: r.payee ?? null,
        note: r.note ?? null,
      })
    }

    const d1 = c.env.DB
    const stmts: D1PreparedStatement[] = []
    if (newCats.length)
      stmts.push(
        d1
          .prepare(
            `INSERT INTO fin_categories (id, user_id, kind, name, icon, color)
             SELECT j.value ->> 'id', ?1, j.value ->> 'kind', j.value ->> 'name', 'circle', '#6b7280'
             FROM json_each(?2) AS j`,
          )
          .bind(userId, JSON.stringify(newCats)),
      )
    if (toInsert.length)
      stmts.push(
        d1
          .prepare(
            `INSERT INTO fin_transactions (id, user_id, type, amount, occurred_on, account_id, category_id, payment_mode, payee, note)
             SELECT j.value ->> 'id', ?1, j.value ->> 'type', j.value ->> 'amount', j.value ->> 'occurredOn', ?2,
                    j.value ->> 'categoryId', j.value ->> 'paymentMode', j.value ->> 'payee', j.value ->> 'note'
             FROM json_each(?3) AS j`,
          )
          .bind(userId, accountId, JSON.stringify(toInsert)),
      )
    if (stmts.length) await d1.batch(stmts)
    const body: ImportResult = {
      imported: toInsert.length,
      duplicates,
      createdCategories: newCats.length,
    }
    return c.json(body)
  })
