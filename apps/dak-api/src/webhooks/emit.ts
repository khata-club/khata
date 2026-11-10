import { newId, WEBHOOK_SCHEMA_VERSION, type WebhookEventType } from '@khata/dak-core'
import { and, eq, isNull } from 'drizzle-orm'

import { control, events, type ControlDb, type EventsDb, type Scoped } from '../db'

export interface WebhookQueueMessage {
  deliveryId: string
  organizationId: string
}

type Email = Pick<
  typeof events.email.$inferSelect,
  'id' | 'environmentId' | 'projectId' | 'reference' | 'tags' | 'metadata' | 'stream'
>

/**
 * Records one webhook delivery per subscribed endpoint and queues them. The event ID is
 * stable (shared by all endpoints, reused by retries and replays) so consumers can dedupe.
 * Payloads never contain message bodies.
 */
export async function emitEmailWebhook(
  env: Env,
  db: { control: Scoped<ControlDb>; events: Scoped<EventsDb> },
  email: Email,
  type: WebhookEventType,
  data: Record<string, unknown> = {},
  opts: { eventId?: string; at?: number } = {},
): Promise<number> {
  const endpoints = await db.control.findMany(
    control.webhookEndpoint,
    and(
      eq(control.webhookEndpoint.environmentId, email.environmentId),
      isNull(control.webhookEndpoint.disabledAt),
    ),
  )
  const subscribed = endpoints.filter(
    (e) => e.eventTypes.includes(type) || e.eventTypes.includes('*'),
  )
  if (!subscribed.length) return 0

  const at = opts.at ?? Date.now()
  const eventId = opts.eventId ?? newId('emailEvent', at)
  const payload = {
    id: eventId,
    type,
    schemaVersion: WEBHOOK_SCHEMA_VERSION,
    createdAt: new Date(at).toISOString(),
    data: {
      emailId: email.id,
      projectId: email.projectId,
      environmentId: email.environmentId,
      stream: email.stream,
      reference: email.reference,
      tags: email.tags,
      metadata: email.metadata,
      ...data,
    },
  }
  const rows = subscribed.map((e) => ({
    id: newId('webhookDelivery', at),
    endpointId: e.id,
    eventId,
    eventType: type,
    emailId: email.id,
    payload,
    status: 'pending' as const,
  }))
  await db.events.db
    .insert(events.webhookDelivery)
    .values(rows.map((r) => ({ ...r, organizationId: db.events.tenant.organizationId })))
    .onConflictDoNothing()
  await env.Q_WEBHOOKS.sendBatch(
    rows.map((r) => ({
      body: {
        deliveryId: r.id,
        organizationId: db.events.tenant.organizationId,
      } satisfies WebhookQueueMessage,
    })),
  )
  return rows.length
}
