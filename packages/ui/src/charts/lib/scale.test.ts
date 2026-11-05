import { describe, expect, it } from 'vitest'

import { f, mk, money, pct, setChartCurrency, smooth, ticks } from './scale'

describe('chart scale helpers', () => {
  it('formats money with a true minus sign', () => {
    expect(money(1234.4)).toBe('$1,234')
    expect(money(-50)).toBe('−$50')
  })

  it('formats compact money', () => {
    expect(mk(950)).toBe('$950')
    expect(mk(4200)).toBe('$4.2k')
    expect(mk(4000)).toBe('$4k')
    expect(mk(42000)).toBe('$42k')
    expect(mk(1_250_000)).toBe('$1.3M')
    expect(mk(-610)).toBe('−$610')
  })

  it('formats rupees with Indian grouping and lakh/crore units', () => {
    setChartCurrency({ symbol: '₹', locale: 'en-IN', compact: 'indian' })
    try {
      expect(money(1234567)).toBe('₹12,34,567')
      expect(mk(950)).toBe('₹950')
      expect(mk(4200)).toBe('₹4.2K')
      expect(mk(150000)).toBe('₹1.5L')
      expect(mk(2500000)).toBe('₹25L')
      expect(mk(34000000)).toBe('₹3.4Cr')
      expect(mk(-100000)).toBe('−₹1L')
    } finally {
      setChartCurrency({ symbol: '$', locale: 'en-US', compact: 'western' })
    }
  })

  it('formats signed percentages', () => {
    expect(pct(4.25)).toBe('+4.3%')
    expect(pct(-1)).toBe('−1.0%')
  })

  it('builds nice ticks that cover the range', () => {
    expect(ticks(0, 4210, 5)).toEqual([0, 1000, 2000, 3000, 4000, 5000])
    expect(ticks(0, 6900, 4)).toEqual([0, 2000, 4000, 6000, 8000])
    expect(ticks(-610, 1300, 5)).toEqual([-1000, -500, 0, 500, 1000, 1500])
  })

  it('draws a smooth path through every point', () => {
    const d = smooth([
      [0, 0],
      [10, 10],
      [20, 0],
    ])
    expect(d.startsWith('M0,0 C')).toBe(true)
    expect(d.endsWith('20,0')).toBe(true)
    expect(f(1.26)).toBe(1.3)
  })
})
