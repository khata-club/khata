import { describe, expect, it } from 'vitest'

import { nextDeliveryStatus, type DeliveryStatus, type ProviderEventType } from './delivery.ts'

const apply = (events: [ProviderEventType, number][], start: DeliveryStatus = 'submitted') => {
  let s = { status: start, at: 0 as number | null }
  for (const [type, at] of events) {
    const n = nextDeliveryStatus(s, { type, at })
    if (n) s = { status: n, at }
  }
  return s.status
}

describe('nextDeliveryStatus', () => {
  it('moves forward through the normal lifecycle', () => {
    expect(
      apply([
        ['send', 1],
        ['delivery_delay', 2],
        ['delivery', 3],
      ]),
    ).toBe('delivered')
  })
  it('is order-independent for delivery vs delay', () => {
    expect(
      apply([
        ['delivery', 3],
        ['delivery_delay', 2],
        ['send', 1],
      ]),
    ).toBe('delivered')
  })
  it('lets complaints and late bounces override delivery', () => {
    expect(
      apply([
        ['delivery', 1],
        ['complaint', 5],
      ]),
    ).toBe('complained')
    expect(
      apply([
        ['delivery', 1],
        ['bounce', 2],
      ]),
    ).toBe('bounced')
    expect(
      apply([
        ['complaint', 5],
        ['delivery', 1],
      ]),
    ).toBe('complained')
  })
  it('never lets engagement change delivery status', () => {
    expect(
      apply([
        ['bounce', 1],
        ['open', 2],
        ['click', 3],
      ]),
    ).toBe('bounced')
  })
  it('reconciles submission uncertain from any provider evidence', () => {
    expect(apply([['send', 1]], 'submission_uncertain')).toBe('submitted')
    expect(apply([['delivery', 1]], 'submission_uncertain')).toBe('delivered')
  })
  it('does not reopen settled recipients', () => {
    expect(apply([['delivery', 1]], 'suppressed')).toBe('suppressed')
    expect(apply([['delivery', 1]], 'cancelled')).toBe('cancelled')
  })
  it('applies rejects only before delivery', () => {
    expect(apply([['reject', 1]])).toBe('rejected')
    expect(
      apply([
        ['delivery', 1],
        ['reject', 2],
      ]),
    ).toBe('delivered')
  })
  it('is idempotent for duplicates', () => {
    expect(
      nextDeliveryStatus({ status: 'delivered', at: 5 }, { type: 'delivery', at: 5 }),
    ).toBeNull()
  })
})
