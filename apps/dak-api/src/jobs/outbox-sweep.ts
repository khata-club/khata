import { and, eq, inArray, isNull, lt, lte, or } from 'drizzle-orm'

import { databases, events, scoped } from '../db'
import { enqueueEmail } from '../sending/queue'
import type { Stream } from '@khata/dak-core'

const MAX_QUEUE_DELAY_MS = 12 * 60 * 60 * 1000
/** A published message whose email is still queued after this long is assumed lost. */
const STALE_MS = 15 * 60 * 1000
const BATCH = 200

/**
 * Cron (every minute): publishes outbox rows that were never handed to a queue (enqueue
 * failed, or scheduled beyond the queue's 12-hour maximum delay) and re-publishes stale
 * ones. Dispatch's conditional claim makes duplicates harmless. System job across tenants.
 */
export async function sweepOutbox(env: Env, now = Date.now()) {
  const db = databases(env).events
  const rows = await db
    .select({
      outbox: events.outbox,
      status: events.email.status,
      scheduledAt: events.email.scheduledAt,
    })
    .from(events.outbox)
    .innerJoin(events.email, eq(events.email.id, events.outbox.emailId))
    .where(
      and(
        lte(events.outbox.availableAt, now + MAX_QUEUE_DELAY_MS),
        or(
          isNull(events.outbox.publishedAt),
          and(
            lt(events.outbox.publishedAt, now - STALE_MS),
            inArray(events.email.status, ['queued', 'accepted']),
          ),
        ),
      ),
    )
    .limit(BATCH)

  let published = 0
  for (const r of rows) {
    if (!['queued', 'accepted', 'scheduled'].includes(r.status)) {
      await db.delete(events.outbox).where(eq(events.outbox.emailId, r.outbox.emailId))
      continue
    }
    const delay = Math.max(0, Math.ceil((r.outbox.availableAt - now) / 1000))
    const ok = await enqueueEmail(
      env,
      scoped(db, { organizationId: r.outbox.organizationId }),
      {
        emailId: r.outbox.emailId,
        organizationId: r.outbox.organizationId,
        stream: r.outbox.stream as Stream,
      },
      delay,
    )
    if (ok) published++
    await db
      .update(events.outbox)
      .set({ attempts: r.outbox.attempts + 1 })
      .where(eq(events.outbox.emailId, r.outbox.emailId))
  }
  return { scanned: rows.length, published }
}
