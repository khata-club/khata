import { STREAMS, type Stream } from '@khata/dak-core'

/** Queue name → handler kind. Names carry an environment suffix (`dak-tx-dev`). */
export type QueueKind = Stream | 'events' | 'webhooks'

const QUEUE_KINDS: Record<string, QueueKind> = {
  auth: 'authentication',
  tx: 'transactional',
  notify: 'notifications',
  marketing: 'marketing',
  events: 'events',
  webhooks: 'webhooks',
}

export function queueKind(queueName: string): QueueKind | undefined {
  const m = /^dak-([a-z]+)(?:-[a-z]+)?$/.exec(queueName)
  return m ? QUEUE_KINDS[m[1]!] : undefined
}

export function isStreamQueue(kind: QueueKind): kind is Stream {
  return (STREAMS as readonly string[]).includes(kind)
}
