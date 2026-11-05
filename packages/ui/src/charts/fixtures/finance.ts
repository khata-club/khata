/**
 * Sample personal-finance data for chart stories, generated exactly as in the Calm Kit prototype
 * (Park–Miller RNG seeded with 11; call order preserved) so stories match the design.
 */
import type { Candle } from '../KCandlestickChart.vue'

function build() {
  let s = 11
  const r = () => {
    s = (s * 16807) % 2147483647
    return (s - 1) / 2147483646
  }
  const nw: number[] = []
  let v = 148000
  for (let i = 0; i < 260; i++) {
    v *= 1 + 0.0019 + (r() - 0.5) * 0.018
    if (i > 110 && i < 122) v *= 0.988
    nw.push(v)
  }
  const spark = (start: number, drift: number, vol: number) => {
    const a: number[] = []
    let x = start
    for (let i = 0; i < 30; i++) {
      x *= 1 + drift + (r() - 0.5) * vol
      a.push(x)
    }
    return a
  }
  const accounts = [
    { name: 'Checking', values: spark(8000, 0.0015, 0.05) },
    { name: 'Savings', values: spark(23600, 0.0008, 0.006) },
    { name: 'Investments', values: spark(82000, 0.002, 0.025) },
    { name: 'Credit card', values: spark(1500, -0.005, 0.08), inverse: true },
  ]
  const candles: Candle[] = []
  let p = 182
  for (let i = 0; i < 36; i++) {
    const o = p
    const c = o * (1 + (r() - 0.47) * 0.03)
    const h = Math.max(o, c) * (1 + r() * 0.01)
    const l = Math.min(o, c) * (1 - r() * 0.01)
    candles.push({ o, c, h, l, v: 0.4 + r() * 0.6 + (Math.abs(c - o) / o) * 12 })
    p = c
  }
  const alloc: number[][] = []
  for (let i = 0; i < 24; i++) {
    const t = i / 23
    const a = [
      52 + 8 * t + (r() - 0.5) * 3,
      25 - 5 * t + (r() - 0.5) * 2,
      13 - 5 * t + (r() - 0.5) * 1.5,
    ]
    a.push(100 - a[0]! - a[1]! - a[2]!)
    alloc.push(a)
  }
  const heat: number[] = []
  for (let i = 0; i < 182; i++) {
    const wd = i % 7
    heat.push(r() < 0.14 ? 0 : Math.round((wd >= 4 ? 40 : 12) + r() * r() * (wd >= 4 ? 190 : 110)))
  }
  return { nw, accounts, candles, alloc, heat }
}

const D = build()

/** Weekly net worth for 5 years, ending Oct 25 2026. */
export const netWorth = { values: D.nw, end: new Date(2026, 9, 25) }
export const accounts = D.accounts
/** 36 trading days ending Oct 28 2026. */
export const holding = { name: 'Total market fund', candles: D.candles, end: new Date(2026, 9, 28) }
export const assetMix = {
  names: ['Stocks', 'Bonds', 'Cash', 'Real estate'],
  rows: D.alloc,
  start: new Date(2024, 10, 1),
  colorIndex: [0, 1, 5, 2],
}
export const monthlySpending = {
  values: [3420, 3980, 3610, 3150, 3290, 3740, 3560, 3880, 4210, 3470, 3320, 3690],
  months: ['Nov', 'Dec', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct'],
  years: [2025, 2025, 2026, 2026, 2026, 2026, 2026, 2026, 2026, 2026, 2026, 2026],
}
export const incomeVsExpenses = {
  months: ['May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct'],
  income: [6200, 6200, 6450, 6200, 6900, 6200],
  expenses: [3560, 3880, 4210, 3470, 3320, 3690],
}
export const categories = [
  { label: 'Housing', value: 1850 },
  { label: 'Food', value: 720 },
  { label: 'Bills', value: 410 },
  { label: 'Leisure', value: 380 },
  { label: 'Transport', value: 340 },
  { label: 'Other', value: 260 },
]
export const categoryMix = {
  names: ['Housing', 'Food', 'Transport', 'Leisure'],
  months: ['May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct'],
  rows: [
    [1850, 690, 320, 420],
    [1850, 740, 360, 510],
    [1850, 710, 300, 380],
    [1900, 780, 410, 460],
    [1900, 650, 330, 520],
    [1900, 720, 340, 380],
  ],
}
/** 26 weeks of daily spend starting Monday Apr 27 2026. */
export const dailySpending = { values: D.heat, start: new Date(2026, 3, 27) }
export const budgets = [
  { name: 'Groceries', spent: 420, budget: 500 },
  { name: 'Dining out', spent: 312, budget: 250 },
  { name: 'Transport', spent: 180, budget: 220 },
  { name: 'Shopping', spent: 264, budget: 300 },
  { name: 'Subscriptions', spent: 64, budget: 60 },
  { name: 'Utilities', spent: 141, budget: 180 },
]

export const incomeFlow = {
  sources: [
    { label: 'Salary', value: 5400 },
    { label: 'Freelance', value: 800 },
  ],
  targets: [
    { label: 'Housing', value: 1850, color: 1 },
    { label: 'Food', value: 720, color: 2 },
    { label: 'Transport', value: 340, color: 3 },
    { label: 'Bills', value: 410, color: 4 },
    { label: 'Leisure', value: 380, color: 5 },
    { label: 'Savings', value: 1500, color: 0 },
    { label: 'Investing', value: 1000, color: '#1D45AC' },
  ],
}
export const incomeToSavings = [
  { label: 'Income', value: 6200 },
  { label: 'Housing', value: -1850 },
  { label: 'Food', value: -720 },
  { label: 'Travel', value: -340 },
  { label: 'Bills', value: -410 },
  { label: 'Leisure', value: -380 },
]
export const netCashFlow = {
  values: [820, 1140, -340, 560, 920, -610, 1300, 450, -220, 780, 1050, 640],
  months: ['Nov', 'Dec', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct'],
}
export const goals = [
  { label: 'Emergency fund', saved: 12300, target: 15000 },
  { label: 'Vacation', saved: 1840, target: 4000 },
  { label: 'House deposit', saved: 13800, target: 60000 },
]
export const health = {
  axes: ['Saving', 'Spending', 'Debt', 'Credit', 'Investing', 'Protection'],
  current: [78, 64, 82, 88, 70, 52],
  previous: [60, 58, 70, 80, 55, 45],
}
/** Treemap tiles with the prototype's hand-tuned placement (omit `rect` for a squarified layout). */
export const portfolio = [
  { label: 'US stocks', value: 57784, color: 0, rect: { x: 0, y: 0, w: 48, h: 64 } },
  { label: 'Intl stocks', value: 31688, color: 1, rect: { x: 0, y: 64, w: 48, h: 36 } },
  { label: 'Bonds', value: 41008, color: 4, rect: { x: 48, y: 0, w: 52, h: 42 } },
  { label: 'Real estate', value: 22368, color: 2, rect: { x: 48, y: 42, w: 20.8, h: 58 } },
  { label: 'Cash', value: 18640, color: 5, rect: { x: 68.8, y: 42, w: 31.2, h: 32.2 } },
  { label: 'Crypto', value: 14912, color: 3, rect: { x: 68.8, y: 74.2, w: 31.2, h: 25.8 } },
]
export const riskReturn = [
  { label: 'Cash', risk: 0.5, ret: 4.2, size: 10, color: 5 },
  { label: 'Bonds', risk: 5, ret: 4.8, size: 22, color: 4 },
  { label: 'REITs', risk: 15, ret: 7.1, size: 12, color: 2 },
  { label: 'US stocks', risk: 16, ret: 9.8, size: 31, color: 0 },
  { label: 'Intl stocks', risk: 19, ret: 7.2, size: 17, color: 1 },
  { label: 'Small cap', risk: 23, ret: 10.6, size: 6, color: 3 },
  { label: 'Crypto', risk: 36, ret: 14, size: 8, color: 4 },
]
