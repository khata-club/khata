import { z } from 'zod'

/**
 * Product streams (spec §5). Each stream has its own queue, quota and rate limits, so
 * marketing volume can never starve authentication mail. Order is dispatch priority.
 */
export const STREAMS = ['authentication', 'transactional', 'notifications', 'marketing'] as const

export const Stream = z.enum(STREAMS)
export type Stream = z.infer<typeof Stream>

/** Lower number dispatches first. */
export function streamPriority(stream: Stream): number {
  return STREAMS.indexOf(stream)
}
