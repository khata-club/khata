import { env } from 'cloudflare:test'
import { beforeEach, describe, expect, it } from 'vitest'

import { monthOf, todayIST } from '../shared/dates'
import type {
  Account,
  Budget,
  Category,
  Goal,
  ImportResult,
  Me,
  MonthSummary,
  NetWorth,
  Recurring,
  TaxReport,
  Transaction,
  TransactionPage,
  TrendPoint,
} from '../shared/types'
import { app } from '../worker'
import { signIn, type Client } from './helpers'

const L = (lakh: number) => Math.round(lakh * 1_00_000_00)
const R = (rupees: number) => rupees * 100

let c: Client
let cats: Category[]
const cat = (name: string) => cats.find((x) => x.name === name)!.id

async function account(body: Partial<Account> & { type: Account['type']; name: string }) {
  const res = await c.post<Account>('/accounts', body)
  expect(res.status).toBe(201)
  return res.json
}

beforeEach(async () => {
  c = await signIn()
  cats = (await c.get<Category[]>('/categories')).json
})

describe('auth', () => {
  it('requires a session for every API route', async () => {
    for (const p of [
      '/me',
      '/accounts',
      '/transactions',
      '/budgets?month=2026-11',
      '/reports/networth',
      '/export.csv',
    ]) {
      const res = await app.request(`/api${p}`, {}, env)
      expect(res.status, p).toBe(401)
    }
  })
  it('returns the profile with default prefs and updates them', async () => {
    const me = await c.get<Me>('/me')
    expect(me.json.prefs).toMatchObject({
      onboarded: false,
      analyticsConsent: null,
      taxParents: 'none',
    })
    const p = await c.patch<Me['prefs']>('/me/prefs', { onboarded: true, analyticsConsent: true })
    expect(p.json).toMatchObject({ onboarded: true, analyticsConsent: true })
  })
  it('keeps the dev login out of production', async () => {
    const res = await app.request(
      '/api/dev/login',
      { method: 'POST' },
      { ...env, ENVIRONMENT: 'production' },
    )
    expect(res.status).toBe(404)
  })
})

describe('accounts and entries', () => {
  it('computes balances from opening balance, entries and transfers', async () => {
    const bank = await account({ type: 'savings', name: 'HDFC Savings', openingBalance: R(50_000) })
    const card = await account({
      type: 'credit_card',
      name: 'ICICI Amazon Pay',
      openingBalance: -R(2_000),
      creditLimit: L(2),
    })
    const today = todayIST()
    const add = (b: object) => c.post<Transaction>('/transactions', { occurredOn: today, ...b })
    expect(
      (
        await add({
          type: 'income',
          amount: R(80_000),
          accountId: bank.id,
          categoryId: cat('Salary'),
        })
      ).status,
    ).toBe(201)
    await add({
      type: 'expense',
      amount: R(1_500),
      accountId: bank.id,
      categoryId: cat('Groceries & kirana'),
      paymentMode: 'upi',
    })
    await add({
      type: 'expense',
      amount: R(3_000),
      accountId: card.id,
      categoryId: cat('Shopping'),
      paymentMode: 'credit_card',
    })
    await add({ type: 'transfer', amount: R(5_000), accountId: bank.id, toAccountId: card.id })

    const accs = (await c.get<Account[]>('/accounts')).json
    expect(accs.find((a) => a.id === bank.id)!.balance).toBe(R(50_000 + 80_000 - 1_500 - 5_000))
    expect(accs.find((a) => a.id === card.id)!.balance).toBe(R(-2_000 - 3_000 + 5_000))
  })

  it('validates entries', async () => {
    const bank = await account({ type: 'cash', name: 'Wallet cash' })
    const noCat = await c.post<{ issues: { path: string }[] }>('/transactions', {
      type: 'expense',
      amount: R(10),
      occurredOn: todayIST(),
      accountId: bank.id,
    })
    expect(noCat.status).toBe(400)
    expect(noCat.json.issues[0]!.path).toBe('categoryId')
    const selfTransfer = await c.post('/transactions', {
      type: 'transfer',
      amount: R(10),
      occurredOn: todayIST(),
      accountId: bank.id,
      toAccountId: bank.id,
    })
    expect(selfTransfer.status).toBe(400)
  })

  it('filters, searches and pages entries', async () => {
    const bank = await account({ type: 'savings', name: 'SBI' })
    for (let i = 1; i <= 5; i++) {
      await c.post('/transactions', {
        type: 'expense',
        amount: R(100 * i),
        occurredOn: `2026-10-0${i}`,
        accountId: bank.id,
        categoryId: cat(i % 2 ? 'Dining & food delivery' : 'Fuel & transport'),
        payee: i === 3 ? 'Swiggy' : 'Indian Oil',
        paymentMode: 'upi',
      })
    }
    const p1 = (await c.get<TransactionPage>('/transactions?month=2026-10&limit=2')).json
    expect(p1.items.map((t) => t.occurredOn)).toEqual(['2026-10-05', '2026-10-04'])
    const p2 = (
      await c.get<TransactionPage>(
        `/transactions?month=2026-10&limit=2&cursor=${encodeURIComponent(p1.nextCursor!)}`,
      )
    ).json
    expect(p2.items.map((t) => t.occurredOn)).toEqual(['2026-10-03', '2026-10-02'])
    const s = (await c.get<TransactionPage>('/transactions?q=swig')).json
    expect(s.items).toHaveLength(1)
    const byCat = (
      await c.get<TransactionPage>(`/transactions?categoryId=${cat('Fuel & transport')}`)
    ).json
    expect(byCat.items).toHaveLength(2)
  })

  it('isolates users from each other', async () => {
    const bank = await account({ type: 'savings', name: 'Mine' })
    const txn = (
      await c.post<Transaction>('/transactions', {
        type: 'expense',
        amount: R(1),
        occurredOn: todayIST(),
        accountId: bank.id,
        categoryId: cat('Rent'),
      })
    ).json
    const other = await signIn()
    expect((await other.get<Account[]>('/accounts')).json).toHaveLength(0)
    expect((await other.get(`/transactions/${txn.id}`)).status).toBe(404)
    expect((await other.del(`/transactions/${txn.id}`)).status).toBe(404)
    expect((await other.patch(`/accounts/${bank.id}`, { name: 'Stolen' })).status).toBe(404)
    // Cannot book entries against someone else's account or category.
    const otherCats = (await other.get<Category[]>('/categories')).json
    const otherBank = (await other.post<Account>('/accounts', { type: 'cash', name: 'Cash' })).json
    expect(
      (
        await other.post('/transactions', {
          type: 'expense',
          amount: R(1),
          occurredOn: todayIST(),
          accountId: bank.id,
          categoryId: otherCats[0]!.id,
        })
      ).status,
    ).toBe(400)
    expect(
      (
        await other.post('/transactions', {
          type: 'expense',
          amount: R(1),
          occurredOn: todayIST(),
          accountId: otherBank.id,
          categoryId: cat('Rent'),
        })
      ).status,
    ).toBe(400)
  })
})

describe('budgets and reports', () => {
  it('tracks spend against budgets and copies them forward', async () => {
    const bank = await account({ type: 'savings', name: 'Axis' })
    const m = '2026-10'
    await c.put('/budgets', {
      month: m,
      categoryId: cat('Dining & food delivery'),
      limit: R(4_000),
    })
    await c.put('/budgets', { month: m, categoryId: cat('Groceries & kirana'), limit: R(10_000) })
    await c.post('/transactions', {
      type: 'expense',
      amount: R(4_500),
      occurredOn: '2026-10-12',
      accountId: bank.id,
      categoryId: cat('Dining & food delivery'),
    })
    const b = (await c.get<Budget[]>(`/budgets?month=${m}`)).json
    expect(b.find((x) => x.categoryId === cat('Dining & food delivery'))).toMatchObject({
      limit: R(4_000),
      spent: R(4_500),
    })

    const copied = (await c.post<Budget[]>('/budgets/copy', { from: m, to: '2026-11' })).json
    expect(copied).toHaveLength(2)
    expect(copied.every((x) => x.spent === 0)).toBe(true)

    const removed = (
      await c.put<Budget[]>('/budgets', {
        month: m,
        categoryId: cat('Groceries & kirana'),
        limit: 0,
      })
    ).json
    expect(removed).toHaveLength(1)
  })

  it('summarises a month and a trend', async () => {
    const bank = await account({ type: 'savings', name: 'Kotak' })
    const add = (b: object) => c.post('/transactions', { accountId: bank.id, ...b })
    await add({
      type: 'income',
      amount: R(90_000),
      occurredOn: '2026-10-01',
      categoryId: cat('Salary'),
    })
    await add({
      type: 'expense',
      amount: R(25_000),
      occurredOn: '2026-10-05',
      categoryId: cat('Rent'),
      paymentMode: 'netbanking',
    })
    await add({
      type: 'expense',
      amount: R(800),
      occurredOn: '2026-10-05',
      categoryId: cat('Dining & food delivery'),
      paymentMode: 'upi',
    })
    await add({
      type: 'expense',
      amount: R(1_200),
      occurredOn: '2026-09-20',
      categoryId: cat('Fuel & transport'),
      paymentMode: 'upi',
    })
    const s = (await c.get<MonthSummary>('/reports/summary?month=2026-10')).json
    expect(s).toMatchObject({ income: R(90_000), expense: R(25_800) })
    expect(s.byCategory[0]).toEqual({ categoryId: cat('Rent'), amount: R(25_000) })
    expect(s.daily).toEqual([{ day: '2026-10-05', amount: R(25_800) }])
    expect(s.byPaymentMode.map((x) => x.paymentMode)).toEqual(['netbanking', 'upi'])

    const t = (await c.get<TrendPoint[]>('/reports/trend?end=2026-10&months=3')).json
    expect(t).toEqual([
      { month: '2026-08', income: 0, expense: 0 },
      { month: '2026-09', income: 0, expense: R(1_200) },
      { month: '2026-10', income: R(90_000), expense: R(25_800) },
    ])
  })
})

describe('bills, SIPs and EMIs', () => {
  it('marks a bill paid: logs the entry and advances the due date', async () => {
    const bank = await account({ type: 'savings', name: 'HDFC' })
    const bill = (
      await c.post<Recurring>('/recurring', {
        kind: 'bill',
        name: 'BESCOM electricity',
        amount: R(1_850),
        nextDueOn: '2026-01-31',
        accountId: bank.id,
        categoryId: cat('Electricity & water'),
      })
    ).json
    const paid = (
      await c.post<{ recurring: Recurring; transaction: Transaction }>(
        `/recurring/${bill.id}/pay`,
        { paidOn: '2026-01-30' },
      )
    ).json
    expect(paid.recurring).toMatchObject({ nextDueOn: '2026-02-28', paidCount: 1 })
    expect(paid.transaction).toMatchObject({
      type: 'expense',
      amount: R(1_850),
      payee: 'BESCOM electricity',
      recurringId: bill.id,
    })
    const again = (await c.post<{ recurring: Recurring }>(`/recurring/${bill.id}/pay`, {})).json
    expect(again.recurring.nextDueOn).toBe('2026-03-31')
  })

  it('tracks EMI outstanding and closes the loan on the last instalment', async () => {
    const bank = await account({ type: 'savings', name: 'SBI' })
    const loan = (
      await c.post<Recurring>('/recurring', {
        kind: 'emi',
        name: 'Car loan',
        amount: R(10_000),
        nextDueOn: '2026-11-05',
        accountId: bank.id,
        categoryId: cat('Loan EMI'),
        loanPrincipal: R(20_000),
        loanRatePct: 0,
        loanTenureMonths: 2,
      })
    ).json
    expect(loan.outstanding).toBe(R(20_000))
    const p1 = (await c.post<{ recurring: Recurring }>(`/recurring/${loan.id}/pay`, {})).json
    expect(p1.recurring).toMatchObject({ outstanding: R(10_000), active: true })
    const p2 = (await c.post<{ recurring: Recurring }>(`/recurring/${loan.id}/pay`, {})).json
    expect(p2.recurring).toMatchObject({ outstanding: 0, active: false })
  })

  it('grows a linked holding when a SIP is paid', async () => {
    const bank = await account({ type: 'savings', name: 'ICICI' })
    const fund = (
      await c.post<{ id: string }>('/holdings', {
        kind: 'mutual_fund',
        name: 'Nifty 50 index fund',
        invested: R(50_000),
        currentValue: R(56_000),
        asOf: '2026-10-01',
      })
    ).json
    const sip = (
      await c.post<Recurring>('/recurring', {
        kind: 'sip',
        name: 'Index SIP',
        amount: R(5_000),
        nextDueOn: '2026-11-10',
        accountId: bank.id,
        categoryId: cat('Investments & SIPs'),
        holdingId: fund.id,
        taxSection: '80C',
      })
    ).json
    await c.post(`/recurring/${sip.id}/pay`, { paidOn: '2026-11-10' })
    const hs = (await c.get<{ id: string; invested: number; currentValue: number }[]>('/holdings'))
      .json
    expect(hs[0]).toMatchObject({ invested: R(55_000), currentValue: R(61_000) })
  })

  it('requires loan details for EMIs', async () => {
    const bank = await account({ type: 'savings', name: 'SBI' })
    const res = await c.post('/recurring', {
      kind: 'emi',
      name: 'x',
      amount: 1,
      nextDueOn: '2026-11-01',
      accountId: bank.id,
    })
    expect(res.status).toBe(400)
  })
})

describe('goals, net worth and tax', () => {
  it('logs goal contributions without going below zero', async () => {
    const g = (await c.post<Goal>('/goals', { name: 'Emergency fund', target: L(3) })).json
    expect(g.monthlyNeeded).toBeNull()
    const g1 = (await c.post<Goal>(`/goals/${g.id}/contributions`, { amount: L(1) })).json
    expect(g1.saved).toBe(L(1))
    const g2 = (await c.post<Goal>(`/goals/${g.id}/contributions`, { amount: -L(5) })).json
    expect(g2.saved).toBe(0)
  })

  it('computes net worth and stores a monthly snapshot', async () => {
    const bank = await account({ type: 'savings', name: 'HDFC', openingBalance: L(2) })
    await account({ type: 'credit_card', name: 'Card', openingBalance: -R(30_000) })
    await c.post('/holdings', {
      kind: 'ppf',
      name: 'PPF',
      invested: L(4),
      currentValue: L(5),
      asOf: todayIST(),
    })
    await c.post('/recurring', {
      kind: 'emi',
      name: 'Home loan',
      amount: R(8_997),
      nextDueOn: todayIST(),
      accountId: bank.id,
      loanPrincipal: L(10),
      loanRatePct: 9,
      loanTenureMonths: 240,
    })
    const nw = (await c.get<NetWorth>('/reports/networth')).json
    expect(nw).toMatchObject({
      cashAndBank: L(2),
      holdings: L(5),
      cardDues: R(30_000),
      loans: L(10),
      assets: L(7),
      liabilities: L(10) + R(30_000),
    })
    expect(nw.netWorth).toBe(L(7) - L(10) - R(30_000))
    expect(nw.history).toEqual([
      { month: monthOf(todayIST()), assets: nw.assets, liabilities: nw.liabilities },
    ])
  })

  it('adds tagged entries and declarations into 80C/80D for the FY', async () => {
    const bank = await account({ type: 'savings', name: 'HDFC' })
    const add = (b: object) =>
      c.post('/transactions', { type: 'expense', accountId: bank.id, ...b })
    await add({
      amount: R(60_000),
      occurredOn: '2026-05-10',
      categoryId: cat('Investments & SIPs'),
      taxSection: '80C',
    })
    await add({
      amount: R(20_000),
      occurredOn: '2026-03-31',
      categoryId: cat('Investments & SIPs'),
      taxSection: '80C',
    }) // previous FY
    await add({
      amount: R(18_000),
      occurredOn: '2026-08-01',
      categoryId: cat('Insurance premium'),
      taxSection: '80D',
    })
    await c.post('/reports/tax/declarations', {
      fy: '2026-27',
      section: '80C',
      label: 'EPF via payroll',
      amount: R(72_000),
    })
    const t = (await c.get<TaxReport>('/reports/tax?fy=2026-27')).json
    const s80c = t.sections.find((s) => s.section === '80C')!
    expect(s80c).toMatchObject({
      used: R(132_000),
      fromEntries: R(60_000),
      fromDeclarations: R(72_000),
      remaining: R(18_000),
    })
    expect(t.sections.find((s) => s.section === '80D')).toMatchObject({
      used: R(18_000),
      limit: R(25_000),
    })
    expect(t.entries).toHaveLength(2)
  })
})

describe('CSV', () => {
  it('imports with category matching and duplicate detection, then exports', async () => {
    const bank = await account({ type: 'savings', name: 'HDFC' })
    const rows = [
      {
        occurredOn: '2026-10-02',
        type: 'expense',
        amount: R(450),
        category: 'groceries & KIRANA',
        payee: 'DMart',
      },
      {
        occurredOn: '2026-10-03',
        type: 'expense',
        amount: R(1_200),
        category: 'Pet care',
        payee: 'Vet',
      },
      { occurredOn: '2026-10-03', type: 'income', amount: R(300), payee: 'Cashback' },
      {
        occurredOn: '2026-10-02',
        type: 'expense',
        amount: R(450),
        category: 'Groceries & kirana',
        payee: 'dmart',
      },
    ]
    const r1 = (await c.post<ImportResult>('/import', { accountId: bank.id, rows })).json
    expect(r1).toEqual({ imported: 3, duplicates: 1, createdCategories: 1 })
    const r2 = (await c.post<ImportResult>('/import', { accountId: bank.id, rows })).json
    expect(r2).toMatchObject({ imported: 0, duplicates: 4 })

    const page = (await c.get<TransactionPage>('/transactions?month=2026-10')).json
    expect(page.items.find((t) => t.payee === 'DMart')!.categoryId).toBe(cat('Groceries & kirana'))
    expect(page.items.find((t) => t.payee === 'Cashback')!.categoryId).toBe(cat('Other income'))

    const csv = await c.get('/export.csv?month=2026-10')
    expect(csv.headers.get('content-type')).toContain('text/csv')
    const lines = csv.text.trim().split('\r\n')
    expect(lines[0]).toContain('Date,Type,Amount (INR)')
    expect(lines).toHaveLength(4)
    expect(csv.text).toContain('2026-10-03,expense,1200.00,HDFC,,Pet care')
  })

  it('neutralises spreadsheet formulas in exports', async () => {
    const bank = await account({ type: 'cash', name: 'Cash' })
    await c.post('/transactions', {
      type: 'expense',
      amount: R(1),
      occurredOn: '2026-10-01',
      accountId: bank.id,
      categoryId: cat('Rent'),
      payee: '=HYPERLINK("x")',
    })
    const csv = await c.get('/export.csv')
    expect(csv.text).toContain(`"'=HYPERLINK(""x"")"`)
  })
})

describe('data deletion', () => {
  it('wipes data and re-seeds categories', async () => {
    await account({ type: 'cash', name: 'Cash' })
    expect((await c.del('/me/data')).status).toBe(204)
    expect((await c.get<Account[]>('/accounts')).json).toHaveLength(0)
    expect((await c.get<Category[]>('/categories')).json.length).toBe(cats.length)
  })
  it('deletes the account and its session', async () => {
    expect((await c.del('/me')).status).toBe(204)
    expect((await c.get('/me')).status).toBe(401)
  })
})
