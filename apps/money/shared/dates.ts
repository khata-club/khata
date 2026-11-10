/** Calendar helpers. Dates travel as ISO `YYYY-MM-DD`, months as `YYYY-MM`, in IST. */

export type ISODate = string
export type Month = string

const pad = (n: number) => String(n).padStart(2, '0')

/** Today's date in India (Asia/Kolkata), regardless of where the code runs. */
export function todayIST(now: Date = new Date()): ISODate {
  const ist = new Date(now.getTime() + 330 * 60_000)
  return `${ist.getUTCFullYear()}-${pad(ist.getUTCMonth() + 1)}-${pad(ist.getUTCDate())}`
}

export const monthOf = (d: ISODate): Month => d.slice(0, 7)

export function parseISO(d: ISODate): { y: number; m: number; day: number } {
  const [y, m, day] = d.split('-').map(Number) as [number, number, number]
  return { y, m, day }
}

export const daysInMonth = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate()

export function addMonths(month: Month, n: number): Month {
  const [y, m] = month.split('-').map(Number) as [number, number]
  const idx = y * 12 + (m - 1) + n
  return `${Math.floor(idx / 12)}-${pad((idx % 12) + 1)}`
}

/** Add months to a date, clamping to month end (31 Jan + 1 month = 28/29 Feb). */
export function addMonthsToDate(d: ISODate, n: number, anchorDay?: number): ISODate {
  const { y, m, day } = parseISO(d)
  const target = addMonths(`${y}-${pad(m)}`, n)
  const { y: ty, m: tm } = parseISO(`${target}-01`)
  const want = anchorDay ?? day
  return `${target}-${pad(Math.min(want, daysInMonth(ty, tm)))}`
}

export function monthBounds(month: Month): { start: ISODate; end: ISODate } {
  const { y, m } = parseISO(`${month}-01`)
  return { start: `${month}-01`, end: `${month}-${pad(daysInMonth(y, m))}` }
}

export function daysBetween(a: ISODate, b: ISODate): number {
  return Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000)
}

/** Months from `month` back `count - 1`, oldest first. */
export function lastMonths(month: Month, count: number): Month[] {
  return Array.from({ length: count }, (_, i) => addMonths(month, i - count + 1))
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** "05 Nov 2026" */
export function formatDate(d: ISODate): string {
  const { y, m, day } = parseISO(d)
  return `${pad(day)} ${MONTHS[m - 1]} ${y}`
}

/** "Nov 2026" or "Nov" with `{ short: true }`. */
export function formatMonth(month: Month, opts: { short?: boolean } = {}): string {
  const { y, m } = parseISO(`${month}-01`)
  return opts.short ? MONTHS[m - 1]! : `${MONTHS[m - 1]} ${y}`
}

// ---- Indian financial year (1 April – 31 March) ----

/** "2026-27" for any date from 1 Apr 2026 to 31 Mar 2027. */
export function fyOf(d: ISODate): string {
  const { y, m } = parseISO(d)
  const start = m >= 4 ? y : y - 1
  return `${start}-${pad((start + 1) % 100)}`
}

export function fyBounds(fy: string): { start: ISODate; end: ISODate } {
  const start = Number(fy.slice(0, 4))
  return { start: `${start}-04-01`, end: `${start + 1}-03-31` }
}

/** "FY 2026-27" */
export const fyLabel = (fy: string) => `FY ${fy}`

export const isFY = (s: string) => {
  const m = /^(\d{4})-(\d{2})$/.exec(s)
  return !!m && (Number(m[1]) + 1) % 100 === Number(m[2])
}
