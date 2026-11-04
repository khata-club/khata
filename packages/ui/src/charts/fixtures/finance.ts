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
