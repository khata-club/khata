import { describe, expect, it } from 'vitest'

import { squarify } from './squarify'

describe('squarify', () => {
  it('tiles the full area with rectangles proportional to the values', () => {
    const values = [31, 17, 22, 12, 10, 8]
    const rects = squarify(values)
    const area = rects.reduce((a, r) => a + r.w * r.h, 0)
    expect(area).toBeCloseTo(10000, 6)
    rects.forEach((r, i) => expect(r.w * r.h).toBeCloseTo(values[i]! * 100, 6))
    rects.forEach((r) => {
      expect(r.x).toBeGreaterThanOrEqual(-1e-9)
      expect(r.y + r.h).toBeLessThanOrEqual(100 + 1e-9)
    })
  })

  it('keeps tiles reasonably square', () => {
    const worst = Math.max(
      ...squarify([31, 17, 22, 12, 10, 8]).map((r) => Math.max(r.w / r.h, r.h / r.w)),
    )
    expect(worst).toBeLessThan(3)
  })

  it('gives zero, negative and NaN values an empty rect and lays out the rest', () => {
    const rects = squarify([30, 0, -5, Number.NaN, 20])
    for (const i of [1, 2, 3]) expect(rects[i]).toEqual({ x: 0, y: 0, w: 0, h: 0 })
    expect(rects[0]!.w * rects[0]!.h + rects[4]!.w * rects[4]!.h).toBeCloseTo(10000, 6)
    for (const r of rects) expect(Number.isNaN(r.w + r.h + r.x + r.y)).toBe(false)
  })

  it('returns empty rects when nothing is positive', () => {
    expect(squarify([0, 0])).toEqual([
      { x: 0, y: 0, w: 0, h: 0 },
      { x: 0, y: 0, w: 0, h: 0 },
    ])
  })
})
