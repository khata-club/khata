/** Number, path and axis helpers shared by every chart (ported from the Calm Kit prototype). */

/** Round to one decimal place (keeps SVG output compact and stable). */
export const f = (n: number) => Math.round(n * 10) / 10

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
export const money = (v: number) =>
  (v < 0 ? '−' : '') + currency.symbol + Math.round(Math.abs(v)).toLocaleString(currency.locale)

const trim = (s: string) => s.replace(/\.0(?=[A-Za-z]+$)/, '')

/** Compact money: "$950", "$4.2k", "$42k", "$1.2M" — or "₹950", "₹4.2K", "₹1.2L", "₹3.4Cr". */
export const mk = (v: number) => {
  const a = Math.abs(v)
  const sg = v < 0 ? '−' : ''
  let t: string
  if (currency.compact === 'indian') {
    t =
      a >= 1e7
        ? trim((a / 1e7).toFixed(a >= 1e8 ? 0 : 1) + 'Cr')
        : a >= 1e5
          ? trim((a / 1e5).toFixed(a >= 1e6 ? 0 : 1) + 'L')
          : a >= 1e3
            ? trim((a / 1e3).toFixed(a >= 1e4 ? 0 : 1) + 'K')
            : String(Math.round(a))
  } else {
    t =
      a >= 1e6
        ? trim((a / 1e6).toFixed(a >= 1e7 ? 0 : 1) + 'M')
        : a >= 1e3
          ? trim((a / 1e3).toFixed(a >= 1e4 ? 0 : 1) + 'k')
          : String(Math.round(a))
  }
  return sg + currency.symbol + t
}

/** Signed percentage with a true minus sign, e.g. "+4.2%" / "−1.0%". */
export const pct = (v: number, digits = 1) => `${v >= 0 ? '+' : '−'}${Math.abs(v).toFixed(digits)}%`

/** "Nice" axis ticks covering [lo, hi] in roughly `n` steps of 1, 2, 2.5 or 5 × 10^k. */
export function ticks(lo: number, hi: number, n: number): number[] {
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
      if (!i) return `${first}${f(p[0])},${f(p[1])}`
      const p0 = pts[i - 2] ?? pts[i - 1]!
      const p1 = pts[i - 1]!
      const p3 = pts[i + 1] ?? p
      const t = 0.17
      return ` C${f(p1[0] + (p[0] - p0[0]) * t)},${f(p1[1] + (p[1] - p0[1]) * t)} ${f(p[0] - (p3[0] - p1[0]) * t)},${f(p[1] - (p3[1] - p1[1]) * t)} ${f(p[0])},${f(p[1])}`
    })
    .join('')
}

/** CSS `d` value so path shapes can transition (`transition: d …`). */
export const cssPath = (d: string) => `path('${d}')`

/** Grid lines + labels for a y scale. */
export const gridOf = (tk: number[], Y: (v: number) => number, fmt: (v: number) => string) =>
  tk.map((v) => ({ y: f(Y(v)), ty: f(Y(v) + 4), label: fmt(v) }))

/** Inline transition helper: `calc(<ms> * var(--k))` scaled by the chart speed. */
export const dur = (ms: number) => `calc(${ms}ms * var(--k))`
