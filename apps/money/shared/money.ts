/** Money is stored and sent as integer paise; these helpers convert and format for India. */

const inr = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
})
const inrPaise = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

/** "₹12,34,567" (rounded to rupees) or "₹12,34,567.50" with `{ paise: true }`. */
export function formatINR(paise: number, opts: { paise?: boolean; sign?: boolean } = {}): string {
  const rupees = paise / 100
  const body = (opts.paise ? inrPaise : inr).format(Math.abs(rupees))
  const sign = rupees < 0 ? '−' : opts.sign && rupees > 0 ? '+' : ''
  return sign + body
}

const trimZero = (s: string) => s.replace(/\.0$/, '')

/** Compact lakh/crore form: "₹950", "₹4.2K", "₹1.5L", "₹3.4Cr". */
export function formatCompactINR(paise: number): string {
  const r = Math.abs(paise / 100)
  const sign = paise < 0 ? '−' : ''
  let body: string
  if (r >= 1e7) body = trimZero((r / 1e7).toFixed(r >= 1e8 ? 0 : 1)) + 'Cr'
  else if (r >= 1e5) body = trimZero((r / 1e5).toFixed(r >= 1e6 ? 0 : 1)) + 'L'
  else if (r >= 1e3) body = trimZero((r / 1e3).toFixed(r >= 1e4 ? 0 : 1)) + 'K'
  else body = String(Math.round(r))
  return `${sign}₹${body}`
}

/**
 * Parse what a person types ("1,50,000", "₹ 2500.5", "1.5L", "2cr", "12k") into paise.
 * Returns null when the text is not a usable amount.
 */
export function parseAmount(input: string): number | null {
  const s = input
    .trim()
    .toLowerCase()
    .replace(/[₹,\s]|rs\.?|inr/g, '')
  const m = /^(\d+(?:\.\d+)?)(k|l|lac|lakh|lakhs|cr|crore|crores)?$/.exec(s)
  if (!m) return null
  const n = Number(m[1])
  const unit = m[2]
  const mult = !unit ? 1 : unit === 'k' ? 1e3 : unit.startsWith('l') ? 1e5 : 1e7
  const paise = Math.round(n * mult * 100)
  return Number.isFinite(paise) ? paise : null
}

/** Paise → plain rupee string for inputs ("1500" or "1500.50"). */
export function paiseToInput(paise: number): string {
  const r = paise / 100
  return Number.isInteger(r) ? String(r) : r.toFixed(2)
}

export const toRupees = (paise: number) => paise / 100
