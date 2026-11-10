/**
 * Per-recipient delivery state machine (spec §14: engagement never overwrites delivery).
 *
 * Provider events arrive at least once and out of order. A status only moves to a higher
 * rank, so a late "delayed" never undoes "delivered" and a click never undoes a bounce or
 * complaint. Equal-rank events keep the newer provider timestamp.
 */

export const DELIVERY_STATUSES = [
  'pending',
  'submission_uncertain',
  'submitted',
  'delayed',
  'delivered',
  'bounced',
  'complained',
  // Settled before reaching the provider; provider events cannot change them.
  'suppressed',
  'rejected',
  'cancelled',
  'expired',
  'failed',
] as const
export type DeliveryStatus = (typeof DELIVERY_STATUSES)[number]

const RANK: Record<DeliveryStatus, number> = {
  pending: 0,
  submission_uncertain: 1,
  submitted: 2,
  delayed: 3,
  delivered: 4,
  bounced: 5,
  complained: 6,
  suppressed: 100,
  rejected: 100,
  cancelled: 100,
  expired: 100,
  failed: 100,
}

export type ProviderEventType =
  | 'send'
  | 'delivery_delay'
  | 'delivery'
  | 'bounce'
  | 'complaint'
  | 'reject'
  | 'rendering_failure'
  | 'open'
  | 'click'

const TARGET: Partial<Record<ProviderEventType, DeliveryStatus>> = {
  send: 'submitted',
  delivery_delay: 'delayed',
  delivery: 'delivered',
  bounce: 'bounced',
  complaint: 'complained',
  reject: 'rejected',
  rendering_failure: 'failed',
}

export function isEngagement(type: ProviderEventType) {
  return type === 'open' || type === 'click'
}

/**
 * Next delivery status for a recipient, or null when the event must not change it.
 * `reject`/`rendering_failure` only apply to mail SES has not delivered yet.
 */
export function nextDeliveryStatus(
  current: { status: DeliveryStatus; at: number | null },
  event: { type: ProviderEventType; at: number },
): DeliveryStatus | null {
  const target = TARGET[event.type]
  if (!target) return null
  if (RANK[current.status] >= 100) return null
  if ((target === 'rejected' || target === 'failed') && RANK[current.status] >= RANK.delivered)
    return null
  const from = RANK[current.status]
  const to = target === 'rejected' || target === 'failed' ? 99 : RANK[target]
  if (to > from) return target
  if (to === from && current.status === target && (current.at ?? 0) < event.at) return target
  return null
}
