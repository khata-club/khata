import { newId, type ProviderEventType } from '@khata/dak-core'
import { and, eq, inArray } from 'drizzle-orm'

import { events, type ControlDb, type EventsDb, type Scoped } from '../db'
import { applyNormalizedEvent, type NormalizedEvent } from '../ingest/ses-events'
import type { StoredPayload } from './accept'
import { buildMime } from './mime'

interface SinkCtx {
  env: Env
  db: { control: Scoped<ControlDb>; events: Scoped<EventsDb> }
  now: number
}

/**
 * Simulator addresses (spec §12 development sink). Anything else is simply "delivered".
 * Mirrors the SES mailbox simulator so tests written against the sink carry over.
 */
export const SINK_DOMAIN = 'simulator.dak.dev'
export const SIMULATIONS: Record<
  string,
  { type: ProviderEventType; bounceType?: string; then?: ProviderEventType }[]
> = {
  success: [{ type: 'delivery' }],
  bounce: [{ type: 'bounce', bounceType: 'Permanent' }],
  softbounce: [{ type: 'bounce', bounceType: 'Transient' }],
  complaint: [{ type: 'delivery' }, { type: 'complaint' }],
  delay: [{ type: 'delivery_delay' }, { type: 'delivery' }],
  reject: [{ type: 'reject' }],
  open: [{ type: 'delivery' }, { type: 'open' }],
  click: [{ type: 'delivery' }, { type: 'open' }, { type: 'click' }],
}

export function simulationFor(address: string) {
  const [local, domain] = address.split('@')
  if (domain !== SINK_DOMAIN) return SIMULATIONS.success!
  return SIMULATIONS[local!.split('+')[0]!] ?? SIMULATIONS.success!
}

export function sinkObjectKey(organizationId: string, emailId: string) {
  return `sink/${organizationId}/${emailId}.eml`
}

/**
 * Sandbox delivery: renders the exact MIME that SES would receive, stores it for the
 * dashboard, then plays simulated provider events through the production event rules.
 * Never contacts SES and never consumes production quota or billing.
 */
export async function deliverToSink(
  ctx: SinkCtx,
  email: typeof events.email.$inferSelect,
  payload: StoredPayload,
  recipients: (typeof events.emailRecipient.$inferSelect)[],
) {
  const ev = ctx.db.events
  const org = ev.tenant.organizationId
  const providerMessageId = `sink-${email.id}`
  const by = (k: 'to' | 'cc') => recipients.filter((r) => r.kind === k).map((r) => r.address)
  const raw = buildMime({
    from: payload.from,
    to: by('to').length ? by('to') : ['undisclosed-recipients:;'],
    cc: by('cc'),
    replyTo: payload.replyTo,
    subject: payload.subject,
    text: payload.text,
    html: payload.html,
    headers: { ...payload.headers, 'X-Dak-Email-ID': email.id, 'X-Dak-Sink': 'true' },
    attachments: payload.attachments,
    messageId: `${email.id}@dak.khata.club`,
    date: new Date(ctx.now),
  })
  await ctx.env.BLOBS.put(sinkObjectKey(org, email.id), raw, {
    httpMetadata: { contentType: 'message/rfc822' },
    customMetadata: { organizationId: org, emailId: email.id },
  })

  await ev.db.batch([
    ev.update(
      events.emailRecipient,
      { deliveryStatus: 'submitted', providerMessageId, submittedAt: ctx.now, statusAt: ctx.now },
      and(
        inArray(
          events.emailRecipient.id,
          recipients.map((r) => r.id),
        ),
        eq(events.emailRecipient.deliveryStatus, 'pending'),
      ),
    ),
    ev.update(events.email, { status: 'sent' }, eq(events.email.id, email.id)),
    ev.insert(events.emailEvent, {
      id: newId('emailEvent', ctx.now),
      emailId: email.id,
      type: 'submitted',
      sourceId: `sink-submitted:${email.id}`,
      providerAt: ctx.now,
      ingestedAt: ctx.now,
      data: { sink: true, providerMessageId },
    }),
  ])

  // Play each recipient's simulated outcomes, 1 ms apart so ordering is deterministic.
  for (const r of recipients) {
    for (const [i, step] of simulationFor(r.address).entries()) {
      const n: NormalizedEvent = {
        type: step.type,
        providerMessageId,
        emailId: email.id,
        organizationId: org,
        at: ctx.now + i + 1,
        recipients: [r.address],
        bounceType: step.bounceType,
        detail:
          step.type === 'delivery'
            ? '250 2.0.0 OK (Dak sink)'
            : step.type === 'bounce'
              ? '550 5.1.1 Simulated bounce'
              : undefined,
      }
      await applyNormalizedEvent(ctx.db, n, `sink:${email.id}:${r.id}:${i}`, ctx.now)
    }
  }
}
