/** Number, path and axis helpers shared by every chart (ported from the Calm Kit prototype). */

/** Round to one decimal place (keeps SVG output compact and stable). */
export const round1 = (n: number) => Math.round(n * 10) / 10

export const MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
]

export interface ChartCurrency {
  /** Prefix symbol, e.g. "$" or "₹". */
  symbol: string
  /** Locale for digit grouping, e.g. "en-US" or "en-IN" (1,00,000). */
  locale: string
  /** Compact units: western (k, M) or indian (K, L, Cr). */
  compact: 'western' | 'indian'
}

const currency: ChartCurrency = { symbol: '$', locale: 'en-US', compact: 'western' }

/** Switch the currency every chart formats with (call once at app start). */
export function setChartCurrency(c: Partial<ChartCurrency>) {
  Object.assign(currency, c)
}

/** "$1,234" / "−$1,234" with a true minus sign (or "₹1,23,456" when set to INR). */
export const money = (v: number) => {
  const whole = Math.round(Math.abs(v))
  return (v < 0 && whole !== 0 ? '−' : '') + currency.symbol + whole.toLocaleString(currency.locale)
}

type CompactUnit = readonly [divisor: number, suffix: string]

/** Smallest unit first. */
const COMPACT_UNITS: Record<ChartCurrency['compact'], readonly CompactUnit[]> = {
  western: [
    [1, ''],
    [1e3, 'k'],
    [1e6, 'M'],
  ],
  indian: [
    [1, ''],
    [1e3, 'K'],
    [1e5, 'L'],
    [1e7, 'Cr'],
  ],
}

/** Magnitude in one unit: whole numbers from 10 up (and for plain amounts), one decimal below. */
const inUnit = (abs: number, divisor: number) => {
  const x = abs / divisor
  return divisor === 1 || x >= 10 ? Math.round(x) : Math.round(x * 10) / 10
}

/** Compact money: "$950", "$4.2k", "$42k", "$1.2M" — or "₹950", "₹4.2K", "₹1.2L", "₹3.4Cr". */
export const compactMoney = (v: number) => {
  const units = COMPACT_UNITS[currency.compact]
  const abs = Math.abs(v)
  let i = units.length - 1
  while (i > 0 && abs < units[i]![0]) i--
  // Pick the unit after rounding, so 999,999 reads "$1M" rather than "$1000k".
  while (i < units.length - 1 && inUnit(abs, units[i]![0]) * units[i]![0] >= units[i + 1]![0]) i++
  const [divisor, suffix] = units[i]!
  const n = inUnit(abs, divisor)
  return (v < 0 && n !== 0 ? '−' : '') + currency.symbol + String(n) + suffix
}

/** Signed percentage with a true minus sign, e.g. "+4.2%" / "−1.0%"; unsigned when it rounds to 0. */
export const pct = (v: number, digits = 1) => {
  const text = Math.abs(v).toFixed(digits)
  const sign = Number(text) === 0 ? '' : v > 0 ? '+' : '−'
  return `${sign}${text}%`
}

/** Percentage change from `from` to `to`, measured against |from|; `null` when there is no base. */
export const pctChange = (from: number, to: number): number | null =>
  from === 0 || !Number.isFinite(from) || !Number.isFinite(to)
    ? null
    : ((to - from) / Math.abs(from)) * 100

/** "Nice" axis ticks covering [lo, hi] in roughly `n` steps of 1, 2, 2.5 or 5 × 10^k. */
export function ticks(lo: number, hi: number, n: number): number[] {
  // Empty, flat or NaN data would give a zero/NaN step below, and the loop would never end.
  if (!Number.isFinite(lo) || !Number.isFinite(hi)) return [0, 1]
  if (hi < lo) [lo, hi] = [hi, lo]
  if (hi === lo) hi = lo + (Math.abs(lo) || 1)
  n = Math.max(1, n)
  const s0 = (hi - lo) / n
  const mg = Math.pow(10, Math.floor(Math.log10(s0)))
  const s = [1, 2, 2.5, 5, 10].map((m) => m * mg).find((x) => x >= s0 - 1e-9)!
  const out: number[] = []
  for (let v = Math.floor(lo / s + 1e-9) * s; ; v += s) {
    out.push(Math.round(v * 1e6) / 1e6)
    if (v >= hi - 1e-9) break
  }
  return out
}

export type Pt = readonly [number, number]

/** Smooth cubic path through points (Catmull-Rom style, tension 0.17). */
export function smooth(pts: readonly Pt[], first = 'M'): string {
  return pts
    .map((p, i) => {
      if (!i) return `${first}${round1(p[0])},${round1(p[1])}`
      const p0 = pts[i - 2] ?? pts[i - 1]!
      const p1 = pts[i - 1]!
      const p3 = pts[i + 1] ?? p
      const t = 0.17
      return ` C${round1(p1[0] + (p[0] - p0[0]) * t)},${round1(p1[1] + (p[1] - p0[1]) * t)} ${round1(p[0] - (p3[0] - p1[0]) * t)},${round1(p[1] - (p3[1] - p1[1]) * t)} ${round1(p[0])},${round1(p[1])}`
    })
    .join('')
}

/** CSS `d` value so path shapes can transition (`transition: d …`). */
export const cssPath = (d: string) => `path('${d}')`

/** Grid lines + labels for a y scale. */
export const gridOf = (
  tickValues: number[],
  y: (value: number) => number,
  format: (value: number) => string,
) => tickValues.map((v) => ({ y: round1(y(v)), ty: round1(y(v) + 4), label: format(v) }))

/** Inline transition helper: `calc(<ms> * var(--k))` scaled by the chart speed. */
export const dur = (ms: number) => `calc(${ms}ms * var(--k))`
