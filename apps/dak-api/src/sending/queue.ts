import type { Stream } from '@khata/dak-core'
import { eq } from 'drizzle-orm'

import { events, type EventsDb, type Scoped } from '../db'

export interface DispatchMessage {
  emailId: string
  organizationId: string
  stream: Stream
}

export function streamQueue(env: Env, stream: Stream): Queue<DispatchMessage> {
  switch (stream) {
    case 'authentication':
      return env.Q_AUTH
    case 'transactional':
      return env.Q_TX
    case 'notifications':
      return env.Q_NOTIFY
    case 'marketing':
      return env.Q_MARKETING
  }
}

/** Publishes to the stream queue and marks the outbox row; failures are left to the sweeper. */
export async function enqueueEmail(
  env: Env,
  db: Scoped<EventsDb>,
  msg: DispatchMessage,
  delaySeconds = 0,
): Promise<boolean> {
  try {
    await streamQueue(env, msg.stream).send(msg, { delaySeconds, contentType: 'json' })
    await db.update(
      events.outbox,
      { publishedAt: Date.now() },
      eq(events.outbox.emailId, msg.emailId),
    )
    return true
  } catch (err) {
    console.error(
      JSON.stringify({
        level: 'warn',
        msg: 'enqueue failed',
        emailId: msg.emailId,
        err: String(err),
      }),
    )
    return false
  }
}
