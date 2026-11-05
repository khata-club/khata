/** Pure helpers for mapping a bank/statement CSV into import rows (no DOM, unit-tested). */
import { parseAmount } from '../../shared/money'
import type { ImportRow } from '../../shared/schemas'

export interface Mapping {
  date: string
  /** 'single' = one signed amount column; 'split' = separate debit / credit columns. */
  amountMode: 'single' | 'split'
  amount?: string
  debit?: string
  credit?: string
  /** For 'single': are positive numbers money spent (most expense trackers) or received (bank statements)? */
  positiveIs?: 'expense' | 'income'
  type?: string
  payee?: string
  category?: string
  note?: string
}

const MONTHS: Record<string, number> = {
  jan: 1,
  feb: 2,
  mar: 3,
  apr: 4,
  may: 5,
  jun: 6,
  jul: 7,
  aug: 8,
  sep: 9,
  oct: 10,
  nov: 11,
  dec: 12,
}
const pad = (n: number) => String(n).padStart(2, '0')

/**
 * Parse common Indian statement dates to ISO: 05/11/2026, 05-11-26, 5 Nov 2026, 05-Nov-2026,
 * 2026-11-05. Day-first is assumed for numeric dates.
 */
export function parseDate(raw: string): string | null {
  const s = raw.trim()
  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(s)
  if (m) return valid(+m[1]!, +m[2]!, +m[3]!)
  m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/.exec(s)
  if (m) return valid(year(m[3]!), +m[2]!, +m[1]!)
  m = /^(\d{1,2})[\s/-]([A-Za-z]{3})[A-Za-z]*[\s/,-]*(\d{2,4})$/.exec(s)
  if (m) {
    const mon = MONTHS[m[2]!.toLowerCase()]
    return mon ? valid(year(m[3]!), mon, +m[1]!) : null
  }
  return null
}
const year = (y: string) => (y.length === 2 ? 2000 + Number(y) : Number(y))
function valid(y: number, m: number, d: number): string | null {
  if (m < 1 || m > 12 || d < 1 || d > 31 || y < 1990 || y > 2100) return null
  const dt = new Date(Date.UTC(y, m - 1, d))
  return dt.getUTCMonth() === m - 1 ? `${y}-${pad(m)}-${pad(d)}` : null
}

/** Signed amount in paise: handles "-1,200.00", "(1,200.00)", "1,200 Dr", "₹500 CR". */
export function parseSigned(raw: string | undefined): number | null {
  if (!raw) return null
  let s = raw.trim()
  if (!s) return null
  let sign = 1
  if (/^\(.*\)$/.test(s)) {
    sign = -1
    s = s.slice(1, -1)
  }
  if (/\bdr\.?$/i.test(s)) {
    sign = -1
    s = s.replace(/\bdr\.?$/i, '')
  } else s = s.replace(/\bcr\.?$/i, '')
  if (s.startsWith('-')) {
    sign = -sign
    s = s.slice(1)
  } else if (s.startsWith('+')) s = s.slice(1)
  const p = parseAmount(s)
  return p == null ? null : sign * p
}

/** Guess a mapping from header names. */
export function guessMapping(headers: string[]): Mapping {
  const find = (...re: RegExp[]) => headers.find((h) => re.some((r) => r.test(h.trim())))
  const debit = find(/^(debit|withdrawal|dr)\b/i, /withdrawal amt/i, /debit amount/i)
  const credit = find(/^(credit|deposit|cr)\b/i, /deposit amt/i, /credit amount/i)
  return {
    date: find(/^(txn |transaction |value )?date$/i, /date/i) ?? headers[0] ?? '',
    amountMode: debit && credit ? 'split' : 'single',
    amount: find(/^amount/i, /amount/i),
    debit,
    credit,
    positiveIs: 'expense',
    type: find(/^type$/i),
    payee: find(/payee|merchant|narration|description|particulars|remarks/i),
    category: find(/categor/i),
    note: find(/^note|memo|^ref/i),
  }
}

export interface MappedResult {
  rows: ImportRow[]
  errors: { line: number; message: string }[]
}

/** Apply a mapping. Lines with no amount (e.g. opening-balance rows) are skipped silently. */
export function applyMapping(data: Record<string, string>[], map: Mapping): MappedResult {
  const rows: ImportRow[] = []
  const errors: MappedResult['errors'] = []
  data.forEach((r, i) => {
    const line = i + 2
    const date = parseDate(r[map.date] ?? '')
    let signed: number | null = null
    let type: 'expense' | 'income' | null = null
    if (map.amountMode === 'split') {
      const dr = parseSigned(r[map.debit ?? ''])
      const cr = parseSigned(r[map.credit ?? ''])
      if (dr) [signed, type] = [Math.abs(dr), 'expense']
      else if (cr) [signed, type] = [Math.abs(cr), 'income']
    } else {
      const v = parseSigned(r[map.amount ?? ''])
      if (v) {
        const t = (r[map.type ?? ''] ?? '').trim().toLowerCase()
        if (/^(income|credit|cr|received)$/.test(t)) type = 'income'
        else if (/^(expense|debit|dr|spent)$/.test(t)) type = 'expense'
        else type = v > 0 === (map.positiveIs !== 'income') ? 'expense' : 'income'
        signed = Math.abs(v)
      }
    }
    if (!signed) return
    if (!date) {
      errors.push({ line, message: `Can’t read the date “${r[map.date] ?? ''}”` })
      return
    }
    const clip = (v: string | undefined, n: number) =>
      (v ?? '').trim().replace(/\s+/g, ' ').slice(0, n) || null
    rows.push({
      occurredOn: date,
      type: type!,
      amount: signed,
      payee: clip(r[map.payee ?? ''], 80),
      category: clip(r[map.category ?? ''], 80),
      note: clip(r[map.note ?? ''], 280),
    })
  })
  return { rows, errors }
}
