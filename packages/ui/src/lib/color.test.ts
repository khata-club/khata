import { describe, expect, it } from 'vitest'

import { inkOn, parseHex, toHex } from './color'

describe('color helpers', () => {
  it('parses short and long hex, rejects junk', () => {
    expect(parseHex('#abc')).toEqual([170, 187, 204])
    expect(parseHex('1F3A5A')).toEqual([31, 58, 90])
    expect(parseHex('nope')).toBeNull()
    expect(toHex([31, 58, 90])).toBe('#1F3A5A')
  })

  it('picks light ink on dark cards and dark ink on pale cards', () => {
    expect(inkOn(parseHex('#1F3A5A')!, 7).light).toBe(false)
    expect(inkOn(parseHex('#EFEBE4')!, 7).light).toBe(true)
  })

  // Main ink targets 7:1; saturated mid-tones (orange, bronze) top out near 5:1 even with pure
  // white, so they only guarantee AA. Muted labels always clear 4.5:1.
  it('keeps text and muted labels above their contrast targets, including mid-tones', () => {
    for (const hex of [
      '#1F3A5A',
      '#4A1520',
      '#EFEBE4',
      '#2F4A3A',
      '#17181B',
      '#C9A86A',
      '#8FA7C4',
      '#D9622B',
      '#7A5C2E',
    ]) {
      const rgb = parseHex(hex)!
      expect(inkOn(rgb, 7, 0.85).ratio).toBeGreaterThanOrEqual(
        hex === '#D9622B' || hex === '#7A5C2E' ? 4.5 : 7,
      )
      expect(inkOn(rgb, 4.5).ratio).toBeGreaterThanOrEqual(4.5)
    }
  })
})
