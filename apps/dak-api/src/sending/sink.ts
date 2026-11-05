import { newId } from '@khata/dak-core'
import { and, eq, inArray } from 'drizzle-orm'

import { events, type ControlDb, type EventsDb, type Scoped } from '../db'
import type { StoredPayload } from './accept'

interface SinkCtx {
  env: Env
  db: { control: Scoped<ControlDb>; events: Scoped<EventsDb> }
  now: number
}

/**
 * Sandbox environments never reach SES: the rendered message is kept and every recipient is
 * marked delivered. Outcome simulation (bounce/complaint addresses) arrives in Dak 14/22.
 */
export async function deliverToSink(
  ctx: SinkCtx,
  email: typeof events.email.$inferSelect,
  _payload: StoredPayload,
  recipients: (typeof events.emailRecipient.$inferSelect)[],
) {
  const ev = ctx.db.events
  const ids = recipients.map((r) => r.id)
  const messageId = `sink-${email.id}`
  await ev.db.batch([
    ev.update(
      events.emailRecipient,
      {
        deliveryStatus: 'delivered',
        providerMessageId: messageId,
        submittedAt: ctx.now,
        deliveredAt: ctx.now,
        statusAt: ctx.now,
      },
      and(
        inArray(events.emailRecipient.id, ids),
        eq(events.emailRecipient.deliveryStatus, 'pending'),
      ),
    ),
    ev.update(events.email, { status: 'sent' }, eq(events.email.id, email.id)),
    ev.insert(events.emailEvent, {
      id: newId('emailEvent', ctx.now),
      emailId: email.id,
      type: 'sink.delivered',
      sourceId: `sink:${email.id}`,
      providerAt: ctx.now,
      ingestedAt: ctx.now,
      data: { recipients: ids.length },
    }),
  ])
}
