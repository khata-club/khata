import { describe, expect, it } from 'vitest'

import { isId, newId, ulid, ulidTime } from './ids.ts'

describe('ulid', () => {
  it('is 26 Crockford base32 characters', () => {
    expect(ulid()).toMatch(/^[0-9A-HJKMNP-TV-Z]{26}$/)
  })

  it('round-trips its timestamp', () => {
    const now = Date.UTC(2026, 10, 5, 12, 0, 0)
    expect(ulidTime(ulid(now))).toBe(now)
  })

  it('sorts by creation time', () => {
    const a = ulid(1_000)
    const b = ulid(2_000)
    expect(a < b).toBe(true)
  })

  it('rejects out-of-range timestamps', () => {
    expect(() => ulid(-1)).toThrow(RangeError)
    expect(() => ulid(2 ** 48)).toThrow(RangeError)
  })

  it('does not repeat', () => {
    const ids = new Set(Array.from({ length: 1000 }, () => ulid(0)))
    expect(ids.size).toBe(1000)
  })
})

describe('newId / isId', () => {
  it('prefixes by kind', () => {
    const id = newId('email')
    expect(id.startsWith('em_')).toBe(true)
    expect(isId('email', id)).toBe(true)
  })

  it('rejects other kinds and malformed values', () => {
    expect(isId('project', newId('email'))).toBe(false)
    expect(isId('email', 'em_not-a-ulid')).toBe(false)
    expect(isId('email', 42)).toBe(false)
  })
})
