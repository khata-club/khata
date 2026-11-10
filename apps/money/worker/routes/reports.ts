import { and, asc, desc, eq, gte, isNotNull, lte, ne, sql } from 'drizzle-orm'
import { Hono } from 'hono'
import { ulid } from 'ulid'
import { z } from 'zod'

import { isLiability } from '../../shared/constants'
import { addMonths, fyBounds, fyOf, monthBounds, monthOf, todayIST } from '../../shared/dates'
import { fy, month, taxDeclarationInput } from '../../shared/schemas'
import { taxProgress } from '../../shared/tax'
import type { HoldingKind, TaxSection } from '../../shared/constants'
import type { MonthSummary, NetWorth, TaxReport, TrendPoint } from '../../shared/types'
import type { DB } from '../db'
import {
  accounts,
  holdings,
  netWorthSnapshots,
  prefs,
  recurring,
  taxDeclarations,
  transactions,
} from '../db/schema'
import { accountBalances } from '../lib/balances'
import { notFound, validate } from '../lib/http'
import { own } from '../lib/owned'
import type { AppEnv } from '../types'
import { recurringDto } from './recurring'
import { txnDto } from './transactions'

export async function monthSummary(db: DB, userId: string, m: string): Promise<MonthSummary> {
  const { start, end } = monthBounds(m)
  const inMonth = own(
    transactions,
    userId,
    gte(transactions.occurredOn, start),
    lte(transactions.occurredOn, end),
  )
  const total = sql<number>`sum(${transactions.amount})`
  const [totals, byCat, byMode, daily] = await Promise.all([
    db
      .select({ type: transactions.type, total })
      .from(transactions)
      .where(and(inMonth, ne(transactions.type, 'transfer')))
      .groupBy(transactions.type),
    db
      .select({ type: transactions.type, categoryId: transactions.categoryId, total })
      .from(transactions)
      .where(and(inMonth, ne(transactions.type, 'transfer')))
      .groupBy(transactions.type, transactions.categoryId)
      .orderBy(desc(total)),
    db
      .select({ paymentMode: transactions.paymentMode, total })
      .from(transactions)
      .where(and(inMonth, eq(transactions.type, 'expense')))
      .groupBy(transactions.paymentMode)
      .orderBy(desc(total)),
    db
      .select({ day: transactions.occurredOn, total })
      .from(transactions)
      .where(and(inMonth, eq(transactions.type, 'expense')))
      .groupBy(transactions.occurredOn)
      .orderBy(asc(transactions.occurredOn)),
  ])
  const t = new Map(totals.map((r) => [r.type, Number(r.total)]))
  return {
    month: m,
    income: t.get('income') ?? 0,
    expense: t.get('expense') ?? 0,
    byCategory: byCat
      .filter((r) => r.type === 'expense')
      .map((r) => ({ categoryId: r.categoryId, amount: Number(r.total) })),
    incomeByCategory: byCat
      .filter((r) => r.type === 'income')
      .map((r) => ({ categoryId: r.categoryId, amount: Number(r.total) })),
    byPaymentMode: byMode.map((r) => ({ paymentMode: r.paymentMode, amount: Number(r.total) })),
    daily: daily.map((r) => ({ day: r.day, amount: Number(r.total) })),
  }
}

export async function trend(
  db: DB,
  userId: string,
  end: string,
  months: number,
): Promise<TrendPoint[]> {
  const first = addMonths(end, -(months - 1))
  const rows = await db
    .select({
      month: sql<string>`substr(${transactions.occurredOn}, 1, 7)`,
      type: transactions.type,
      total: sql<number>`sum(${transactions.amount})`,
    })
    .from(transactions)
    .where(
      own(
        transactions,
        userId,
        ne(transactions.type, 'transfer'),
        gte(transactions.occurredOn, `${first}-01`),
        lte(transactions.occurredOn, monthBounds(end).end),
      ),
    )
    .groupBy(sql`1`, transactions.type)
  const out: TrendPoint[] = Array.from({ length: months }, (_, i) => ({
    month: addMonths(first, i),
    income: 0,
    expense: 0,
  }))
  const idx = new Map(out.map((p, i) => [p.month, i]))
  for (const r of rows) {
    const p = out[idx.get(r.month) ?? -1]
    if (p && (r.type === 'income' || r.type === 'expense')) p[r.type] = Number(r.total)
  }
  return out
}

export async function netWorth(db: DB, userId: string): Promise<NetWorth> {
  const [accs, balances, hs, emis] = await Promise.all([
    db
      .select()
      .from(accounts)
      .where(own(accounts, userId, eq(accounts.archived, false))),
    accountBalances(db, userId),
    db.select().from(holdings).where(own(holdings, userId)),
    db
      .select()
      .from(recurring)
      .where(own(recurring, userId, eq(recurring.kind, 'emi'), eq(recurring.active, true))),
  ])
  let cashAndBank = 0
  let cardDues = 0
  for (const a of accs) {
    const b = balances.get(a.id) ?? a.openingBalance
    if (isLiability(a.type)) cardDues += Math.max(0, -b)
    else cashAndBank += b
  }
  const byKind = new Map<HoldingKind, number>()
  let holdingsTotal = 0
  for (const h of hs) {
    holdingsTotal += h.currentValue
    byKind.set(h.kind, (byKind.get(h.kind) ?? 0) + h.currentValue)
  }
  const loans = emis.reduce((a, r) => a + (recurringDto(r).outstanding ?? 0), 0)
  const assets = Math.max(0, cashAndBank) + holdingsTotal
  const liabilities = cardDues + loans + Math.max(0, -cashAndBank)

  // Keep this month's snapshot current so the trend line builds itself over time.
  const thisMonth = monthOf(todayIST())
  await db
    .insert(netWorthSnapshots)
    .values({ userId, month: thisMonth, assets, liabilities })
    .onConflictDoUpdate({
      target: [netWorthSnapshots.userId, netWorthSnapshots.month],
      set: { assets, liabilities },
    })
  const history = await db
    .select({
      month: netWorthSnapshots.month,
      assets: netWorthSnapshots.assets,
      liabilities: netWorthSnapshots.liabilities,
    })
    .from(netWorthSnapshots)
    .where(own(netWorthSnapshots, userId, gte(netWorthSnapshots.month, addMonths(thisMonth, -23))))
    .orderBy(asc(netWorthSnapshots.month))

  return {
    assets,
    liabilities,
    netWorth: assets - liabilities,
    cashAndBank,
    holdings: holdingsTotal,
    cardDues,
    loans,
    byHoldingKind: [...byKind]
      .map(([kind, value]) => ({ kind, value }))
      .sort((a, b) => b.value - a.value),
    history,
  }
}

export async function taxReport(db: DB, userId: string, fyStr: string): Promise<TaxReport> {
  const { start, end } = fyBounds(fyStr)
  const [entries, decls, [p]] = await Promise.all([
    db
      .select()
      .from(transactions)
      .where(
        own(
          transactions,
          userId,
          isNotNull(transactions.taxSection),
          ne(transactions.type, 'income'),
          gte(transactions.occurredOn, start),
          lte(transactions.occurredOn, end),
        ),
      )
      .orderBy(desc(transactions.occurredOn)),
    db
      .select()
      .from(taxDeclarations)
      .where(own(taxDeclarations, userId, eq(taxDeclarations.fy, fyStr)))
      .orderBy(asc(taxDeclarations.createdAt)),
    db.select().from(prefs).where(eq(prefs.userId, userId)),
  ])
  const fromEntries: Partial<Record<TaxSection, number>> = {}
  const fromDecl: Partial<Record<TaxSection, number>> = {}
  for (const e of entries) fromEntries[e.taxSection!] = (fromEntries[e.taxSection!] ?? 0) + e.amount
  for (const d of decls) fromDecl[d.section] = (fromDecl[d.section] ?? 0) + d.amount
  const used: Partial<Record<TaxSection, number>> = {}
  for (const s of ['80C', '80D', '80CCD1B'] as const)
    used[s] = (fromEntries[s] ?? 0) + (fromDecl[s] ?? 0)
  const progress = taxProgress(used, {
    selfSenior: p?.taxSelfSenior ?? false,
    parents: p?.taxParents ?? 'none',
  })
  return {
    fy: fyStr,
    sections: progress.map((s) => ({
      ...s,
      fromEntries: fromEntries[s.section] ?? 0,
      fromDeclarations: fromDecl[s.section] ?? 0,
    })),
    declarations: decls.map((d) => ({
      id: d.id,
      fy: d.fy,
      section: d.section,
      label: d.label,
      amount: d.amount,
    })),
    entries: entries.map(txnDto),
  }
}

export const reportRoutes = new Hono<AppEnv>()
  .get('/summary', validate('query', z.object({ month })), async (c) =>
    c.json(await monthSummary(c.var.db, c.var.userId, c.req.valid('query').month)),
  )
  .get(
    '/trend',
    validate(
      'query',
      z.object({
        end: month.optional(),
        months: z.coerce.number().int().min(1).max(24).default(6),
      }),
    ),
    async (c) => {
      const q = c.req.valid('query')
      return c.json(await trend(c.var.db, c.var.userId, q.end ?? monthOf(todayIST()), q.months))
    },
  )
  .get('/networth', async (c) => c.json(await netWorth(c.var.db, c.var.userId)))
  .get('/tax', validate('query', z.object({ fy: fy.optional() })), async (c) => {
    const f = c.req.valid('query').fy ?? fyOf(todayIST())
    return c.json(await taxReport(c.var.db, c.var.userId, f))
  })
  .post('/tax/declarations', validate('json', taxDeclarationInput), async (c) => {
    const { db, userId } = c.var
    const body = c.req.valid('json')
    await db.insert(taxDeclarations).values({ ...body, id: ulid(), userId })
    return c.json(await taxReport(db, userId, body.fy), 201)
  })
  .delete('/tax/declarations/:id', async (c) => {
    const { db, userId } = c.var
    const res = await db
      .delete(taxDeclarations)
      .where(own(taxDeclarations, userId, eq(taxDeclarations.id, c.req.param('id'))))
      .returning({ id: taxDeclarations.id })
    if (!res.length) throw notFound()
    return c.body(null, 204)
  })
