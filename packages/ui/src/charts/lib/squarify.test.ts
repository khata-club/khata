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
})
