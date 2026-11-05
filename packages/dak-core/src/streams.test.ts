import { describe, expect, it } from 'vitest'

import { Stream, STREAMS, streamPriority } from './streams.ts'

describe('streams', () => {
  it('puts authentication first and marketing last', () => {
    expect(streamPriority('authentication')).toBe(0)
    expect(streamPriority('marketing')).toBe(STREAMS.length - 1)
  })

  it('validates stream names', () => {
    expect(Stream.safeParse('transactional').success).toBe(true)
    expect(Stream.safeParse('promo').success).toBe(false)
  })
})
