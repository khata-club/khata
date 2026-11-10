import { describe, expect, it } from 'vitest'

import {
  addMonthsToDate,
  formatDate,
  fyBounds,
  fyOf,
  isFY,
  lastMonths,
  todayIST,
} from '../shared/dates'
import { amortization, emi, outstandingAfter } from '../shared/loans'
import { formatCompactINR, formatINR, parseAmount } from '../shared/money'
import { bucket, dueState, monthlyNeeded, nextDueDate } from '../shared/plan'
import { limit80D, taxProgress } from '../shared/tax'

describe('money', () => {
  it('formats rupees with Indian grouping', () => {
    expect(formatINR(1234567_00)).toBe('₹12,34,567')
    expect(formatINR(-50_00)).toBe('−₹50')
    expect(formatINR(1999_50, { paise: true })).toBe('₹1,999.50')
    expect(formatINR(500_00, { sign: true })).toBe('+₹500')
  })
  it('formats compact lakh and crore', () => {
    expect(formatCompactINR(950_00)).toBe('₹950')
    expect(formatCompactINR(4_200_00)).toBe('₹4.2K')
    expect(formatCompactINR(1_50_000_00)).toBe('₹1.5L')
    expect(formatCompactINR(25_00_000_00)).toBe('₹25L')
    expect(formatCompactINR(3_40_00_000_00)).toBe('₹3.4Cr')
    expect(formatCompactINR(-1_00_000_00)).toBe('−₹1L')
  })
  it('parses what people type', () => {
    expect(parseAmount('1,50,000')).toBe(1_50_000_00)
    expect(parseAmount('₹ 2500.5')).toBe(2500_50)
    expect(parseAmount('1.5L')).toBe(1_50_000_00)
    expect(parseAmount('2 cr')).toBe(2_00_00_000_00)
    expect(parseAmount('12k')).toBe(12_000_00)
    expect(parseAmount('Rs. 99')).toBe(99_00)
    expect(parseAmount('abc')).toBeNull()
    expect(parseAmount('')).toBeNull()
  })
})

describe('dates and financial year', () => {
  it('maps dates to the April–March FY', () => {
    expect(fyOf('2026-03-31')).toBe('2025-26')
    expect(fyOf('2026-04-01')).toBe('2026-27')
    expect(fyOf('2027-01-15')).toBe('2026-27')
    expect(fyOf('2099-12-01')).toBe('2099-00')
    expect(fyBounds('2026-27')).toEqual({ start: '2026-04-01', end: '2027-03-31' })
    expect(isFY('2026-27')).toBe(true)
    expect(isFY('2026-28')).toBe(false)
  })
  it('uses IST for today', () => {
    // 20:00 UTC on 4 Nov is 01:30 on 5 Nov in India.
    expect(todayIST(new Date('2026-11-04T20:00:00Z'))).toBe('2026-11-05')
  })
  it('clamps month arithmetic to month end', () => {
    expect(addMonthsToDate('2026-01-31', 1)).toBe('2026-02-28')
    expect(addMonthsToDate('2028-01-31', 1)).toBe('2028-02-29')
    expect(addMonthsToDate('2026-02-28', 1, 31)).toBe('2026-03-31')
    expect(addMonthsToDate('2026-11-15', 3)).toBe('2027-02-15')
    expect(lastMonths('2026-02', 3)).toEqual(['2025-12', '2026-01', '2026-02'])
    expect(formatDate('2026-11-05')).toBe('05 Nov 2026')
  })
})

describe('loans', () => {
  it('computes EMI for a known home loan', () => {
    // ₹10 lakh at 9% for 20 years ≈ ₹8,997 a month.
    expect(Math.round(emi(10_00_000_00, 9, 240) / 100)).toBe(8997)
    expect(emi(12_000_00, 0, 12)).toBe(1_000_00)
  })
  it('amortizes to zero', () => {
    const rows = amortization(5_00_000_00, 10.5, 60)
    expect(rows).toHaveLength(60)
    expect(rows.at(-1)!.balance).toBe(0)
    expect(rows.reduce((a, r) => a + r.principal, 0)).toBe(5_00_000_00)
    expect(outstandingAfter(5_00_000_00, 10.5, 60, 0)).toBe(5_00_000_00)
    expect(outstandingAfter(5_00_000_00, 10.5, 60, 60)).toBe(0)
    expect(outstandingAfter(5_00_000_00, 10.5, 60, 12)).toBeLessThan(5_00_000_00)
  })
})

describe('planning', () => {
  it('advances due dates keeping the anchor day', () => {
    expect(nextDueDate('2026-01-31', 'monthly', 31)).toBe('2026-02-28')
    expect(nextDueDate('2026-02-28', 'monthly', 31)).toBe('2026-03-31')
    expect(nextDueDate('2026-04-10', 'quarterly')).toBe('2026-07-10')
    expect(nextDueDate('2026-04-10', 'yearly')).toBe('2027-04-10')
  })
  it('computes goal monthly need', () => {
    expect(monthlyNeeded(1_00_000_00, 40_000_00, '2027-11-05', '2026-11-05')).toBe(5_000_00)
    expect(monthlyNeeded(100, 200, null, '2026-11-05')).toBe(0)
    expect(monthlyNeeded(100, 0, null, '2026-11-05')).toBeNull()
  })
  it('classifies due dates', () => {
    expect(dueState('2026-11-01', '2026-11-05')).toBe('overdue')
    expect(dueState('2026-11-05', '2026-11-05')).toBe('today')
    expect(dueState('2026-11-10', '2026-11-05')).toBe('soon')
    expect(dueState('2026-12-10', '2026-11-05')).toBe('later')
  })
  it('buckets counts for analytics', () => {
    expect([0, 1, 10, 11, 500, 5000].map(bucket)).toEqual([
      '0',
      '1-10',
      '1-10',
      '11-100',
      '101-1000',
      '1000+',
    ])
  })
})

describe('tax', () => {
  it('caps 80C at ₹1.5 lakh and sizes 80D by age', () => {
    const [c80, d80, nps] = taxProgress(
      { '80C': 2_00_000_00, '80D': 30_000_00, '80CCD1B': 10_000_00 },
      { selfSenior: false, parents: 'senior' },
    )
    expect(c80).toMatchObject({ limit: 1_50_000_00, remaining: 0, pct: 100 })
    expect(d80).toMatchObject({ limit: 75_000_00, remaining: 45_000_00, pct: 40 })
    expect(nps).toMatchObject({ limit: 50_000_00, remaining: 40_000_00, pct: 20 })
    expect(limit80D(true, 'none')).toBe(50_000_00)
  })
})
