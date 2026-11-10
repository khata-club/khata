import { describe, expect, it } from 'vitest'

import {
  evaluateChannel,
  evaluateTransform,
  keyframeTimes,
  splitChannel,
  upsertKeyframe,
} from './animation'
import { type Keyframe, createClip } from './model'

const kf = (t: number, v: number, interp: Keyframe['interp'] = 'linear'): Keyframe => ({
  t,
  v,
  interp,
})

describe('keyframe interpolation', () => {
  it('returns the base value without keyframes', () => {
    expect(evaluateChannel(undefined, 5, 3)).toBe(3)
    expect(evaluateChannel([], 5, 3)).toBe(3)
  })

  it('holds the end values outside the keyframe range', () => {
    const k = [kf(10, 1), kf(20, 2)]
    expect(evaluateChannel(k, 0, 0)).toBe(1)
    expect(evaluateChannel(k, 30, 0)).toBe(2)
  })

  it('interpolates linearly', () => {
    const k = [kf(0, 0), kf(100, 10), kf(200, 0)]
    expect(evaluateChannel(k, 50, 0)).toBe(5)
    expect(evaluateChannel(k, 150, 0)).toBe(5)
    expect(evaluateChannel(k, 100, 0)).toBe(10)
  })

  it('holds on hold keyframes', () => {
    const k = [kf(0, 0, 'hold'), kf(100, 10)]
    expect(evaluateChannel(k, 99, 0)).toBe(0)
    expect(evaluateChannel(k, 100, 0)).toBe(10)
  })

  it('is deterministic: the same timestamp always gives the same value', () => {
    const k = [kf(0, 0.1), kf(7, 0.9), kf(13, 0.3)]
    const a = Array.from({ length: 50 }, (_, i) => evaluateChannel(k, i * 0.37, 0))
    const b = Array.from({ length: 50 }, (_, i) => evaluateChannel(k, i * 0.37, 0))
    expect(a).toEqual(b)
  })

  it('upserts sorted and replaces on the same tick', () => {
    let k = upsertKeyframe(undefined, 50, 1)
    k = upsertKeyframe(k, 10, 2)
    k = upsertKeyframe(k, 30, 3, 'hold')
    k = upsertKeyframe(k, 30, 4)
    expect(k.map((x) => x.t)).toEqual([10, 30, 50])
    expect(k[1]).toEqual({ t: 30, v: 4, interp: 'hold' })
  })

  it('splits a channel without changing values on either side', () => {
    const k = [kf(0, 0), kf(100, 10)]
    const { left, right } = splitChannel(k, 40, 0)
    for (const t of [0, 20, 40])
      expect(evaluateChannel(left, t, 0)).toBeCloseTo(evaluateChannel(k, t, 0))
    for (const t of [40, 70, 100])
      expect(evaluateChannel(right, t - 40, 0)).toBeCloseTo(evaluateChannel(k, t, 0))
  })

  it('evaluates the full transform and lists keyframe times', () => {
    const c = createClip({ kind: 'media', start: 0, duration: 100 })
    c.keyframes = { x: [kf(0, 0), kf(100, 100)], opacity: [kf(50, 0.5)] }
    const tr = evaluateTransform(c, 25)
    expect(tr.x).toBe(25)
    expect(tr.opacity).toBe(0.5)
    expect(tr.scale).toBe(1)
    expect(keyframeTimes(c)).toEqual([0, 50, 100])
  })
})
