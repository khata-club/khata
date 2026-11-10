import { describe, expect, it } from 'vitest'

import {
  FPS,
  TICKS_PER_SECOND,
  floorToFrame,
  formatTimecode,
  frameToTicks,
  microsToTicks,
  rationalFromFloat,
  roundToFrame,
  samplesToTicks,
  ticksPerFrame,
  ticksToFrame,
  ticksToMicros,
  ticksToSamples,
} from './time'

describe('time model', () => {
  it('has an exact integer frame length for every standard rate', () => {
    for (const r of Object.values(FPS)) expect(Number.isInteger(ticksPerFrame(r))).toBe(true)
  })

  it('has an exact integer sample length at 44.1, 48 and 96 kHz', () => {
    for (const sr of [44100, 48000, 96000])
      expect(Number.isInteger(TICKS_PER_SECOND / sr)).toBe(true)
  })

  it('round-trips frames ↔ ticks without drift over long durations', () => {
    for (const r of Object.values(FPS)) {
      for (const f of [0, 1, 29, 1799, 107892, 215784]) {
        expect(ticksToFrame(frameToTicks(f, r), r)).toBe(f)
        // One tick before a frame boundary still belongs to the previous frame.
        if (f > 0) expect(ticksToFrame(frameToTicks(f, r) - 1, r)).toBe(f - 1)
      }
    }
  })

  it('stays exact 120 minutes into a 59.94 sequence', () => {
    const r = FPS['59.94']
    const frames = 2 * 60 * 60 * 60 // nominal
    const t = frameToTicks(frames, r)
    expect(Number.isSafeInteger(t)).toBe(true)
    expect(ticksToFrame(t, r)).toBe(frames)
  })

  it('floors and rounds to frames', () => {
    const r = FPS['30']
    const f = ticksPerFrame(r)
    expect(floorToFrame(f * 3 + 10, r)).toBe(f * 3)
    expect(roundToFrame(f * 3 + f / 2 + 1, r)).toBe(f * 4)
  })

  it('converts samples and microseconds', () => {
    expect(ticksToSamples(TICKS_PER_SECOND, 48000)).toBe(48000)
    expect(samplesToTicks(48000, 48000)).toBe(TICKS_PER_SECOND)
    expect(ticksToMicros(TICKS_PER_SECOND)).toBe(1_000_000)
    expect(microsToTicks(1_000_000)).toBe(TICKS_PER_SECOND)
  })

  it('formats timecode', () => {
    expect(formatTimecode(frameToTicks(30 * 3661 + 7, FPS['30']), FPS['30'])).toBe('01:01:01:07')
    expect(formatTimecode(0, FPS['25'])).toBe('00:00:00:00')
  })

  it('maps measured rates to rationals', () => {
    expect(rationalFromFloat(29.97003)).toEqual({ num: 30000, den: 1001 })
    expect(rationalFromFloat(25)).toEqual({ num: 25, den: 1 })
    expect(rationalFromFloat(Number.NaN)).toEqual({ num: 30, den: 1 })
  })
})
