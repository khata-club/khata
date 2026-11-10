import { describe, expect, it } from 'vitest'

import {
  compactMoney,
  money,
  pct,
  pctChange,
  round1,
  setChartCurrency,
  smooth,
  ticks,
} from './scale'

describe('chart scale helpers', () => {
  it('formats money with a true minus sign', () => {
    expect(money(1234.4)).toBe('$1,234')
    expect(money(-50)).toBe('−$50')
    expect(money(-0.3)).toBe('$0')
  })

  it('formats compact money', () => {
    expect(compactMoney(950)).toBe('$950')
    expect(compactMoney(4200)).toBe('$4.2k')
    expect(compactMoney(4000)).toBe('$4k')
    expect(compactMoney(42000)).toBe('$42k')
    expect(compactMoney(1_250_000)).toBe('$1.3M')
    expect(compactMoney(-610)).toBe('−$610')
  })

  it('picks the compact unit after rounding', () => {
    expect(compactMoney(999.6)).toBe('$1k')
    expect(compactMoney(999_999)).toBe('$1M')
    expect(compactMoney(9_960)).toBe('$10k')
    setChartCurrency({ symbol: '₹', locale: 'en-IN', compact: 'indian' })
    try {
      expect(compactMoney(99_999)).toBe('₹1L')
    } finally {
      setChartCurrency({ symbol: '$', locale: 'en-US', compact: 'western' })
    }
  })

  it('formats rupees with Indian grouping and lakh/crore units', () => {
    setChartCurrency({ symbol: '₹', locale: 'en-IN', compact: 'indian' })
    try {
      expect(money(1234567)).toBe('₹12,34,567')
      expect(compactMoney(950)).toBe('₹950')
      expect(compactMoney(4200)).toBe('₹4.2K')
      expect(compactMoney(150000)).toBe('₹1.5L')
      expect(compactMoney(2500000)).toBe('₹25L')
      expect(compactMoney(34000000)).toBe('₹3.4Cr')
      expect(compactMoney(-100000)).toBe('−₹1L')
    } finally {
      setChartCurrency({ symbol: '$', locale: 'en-US', compact: 'western' })
    }
  })

  it('formats signed percentages', () => {
    expect(pct(4.25)).toBe('+4.3%')
    expect(pct(-1)).toBe('−1.0%')
    expect(pct(-0.04)).toBe('0.0%')
  })

  it('measures percentage change against |from| and has no base at 0', () => {
    expect(pctChange(100, 110)).toBeCloseTo(10)
    expect(pctChange(-100, 100)).toBeCloseTo(200)
    expect(pctChange(0, 50)).toBeNull()
  })

  it('builds nice ticks that cover the range', () => {
    expect(ticks(0, 4210, 5)).toEqual([0, 1000, 2000, 3000, 4000, 5000])
    expect(ticks(0, 6900, 4)).toEqual([0, 2000, 4000, 6000, 8000])
    expect(ticks(-610, 1300, 5)).toEqual([-1000, -500, 0, 500, 1000, 1500])
  })

  it('returns finite ticks for empty, flat, reversed or NaN ranges (no infinite loop)', () => {
    expect(ticks(0, 0, 4)).toEqual([0, 0.25, 0.5, 0.75, 1])
    expect(ticks(5, 5, 4)).toEqual([4, 6, 8, 10])
    expect(ticks(100, 0, 4)).toEqual([0, 25, 50, 75, 100])
    expect(ticks(0, Number.NaN, 4)).toEqual([0, 1])
    expect(ticks(0, Math.max(), 4)).toEqual([0, 1])
  })

  it('draws a smooth path through every point', () => {
    const d = smooth([
      [0, 0],
      [10, 10],
      [20, 0],
    ])
    expect(d.startsWith('M0,0 C')).toBe(true)
    expect(d.endsWith('20,0')).toBe(true)
    expect(round1(1.26)).toBe(1.3)
  })
})
