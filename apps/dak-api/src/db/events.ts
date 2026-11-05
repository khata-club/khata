/**
 * Delivery database (binding `DB_EVENTS`): emails, recipients, attempts, provider events, the
 * dispatch outbox, webhook deliveries and the usage ledger. High write volume; rows are purged
 * by retention policy. Keyed by ULID so inserts append.
 */
import { index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core'

import { createdAt, json, ms, organizationId } from './columns'

export const email = sqliteTable(
  'email',
  {
    id: text('id').primaryKey(),
    organizationId: organizationId(),
    projectId: text('project_id').notNull(),
    environmentId: text('environment_id').notNull(),
    stream: text('stream', {
      enum: ['authentication', 'transactional', 'notifications', 'marketing'],
    }).notNull(),
    /** Aggregate lifecycle across recipients; per-recipient outcome lives on email_recipient. */
    status: text('status', {
      enum: [
        'accepted',
        'scheduled',
        'queued',
        'sending',
        'sent',
        'cancelled',
        'expired',
        'failed',
      ],
    }).notNull(),
    fromAddress: text('from_address').notNull(),
    subject: text('subject').notNull(),
    templateVersionId: text('template_version_id'),
    /** R2 key of the pinned rendered payload (null in zero-body-retention mode once sent). */
    payloadKey: text('payload_key'),
    sizeBytes: integer('size_bytes').notNull().default(0),
    idempotencyKey: text('idempotency_key'),
    reference: text('reference'),
    tags: json<Record<string, string>>('tags').notNull().default({}),
    metadata: json<Record<string, string>>('metadata').notNull().default({}),
    resendOf: text('resend_of'),
    traceparent: text('traceparent'),
    apiKeyId: text('api_key_id'),
    scheduledAt: ms('scheduled_at'),
    expiresAt: ms('expires_at'),
    cancelledAt: ms('cancelled_at'),
    acceptedAt: ms('accepted_at').notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    index('email_env_time').on(t.organizationId, t.environmentId, t.id),
    index('email_reference').on(t.environmentId, t.reference),
    index('email_scheduled').on(t.status, t.scheduledAt),
  ],
)

export const emailRecipient = sqliteTable(
  'email_recipient',
  {
    id: text('id').primaryKey(),
    organizationId: organizationId(),
    emailId: text('email_id').notNull(),
    projectId: text('project_id').notNull(),
    /** Lower-cased address. Never exposed to other recipients (BCC isolation). */
    address: text('address').notNull(),
    kind: text('kind', { enum: ['to', 'cc', 'bcc'] }).notNull(),
    /** Delivery outcome. Engagement is tracked separately and never overwrites this. */
    deliveryStatus: text('delivery_status', {
      enum: [
        'pending',
        'suppressed',
        'submitted',
        'submission_uncertain',
        'delayed',
        'delivered',
        'bounced',
        'complained',
        'rejected',
        'cancelled',
        'expired',
        'failed',
      ],
    }).notNull(),
    /** Provider timestamp of the event that set deliveryStatus (out-of-order guard). */
    statusAt: ms('status_at'),
    providerMessageId: text('provider_message_id'),
    bounceType: text('bounce_type'),
    smtpResponse: text('smtp_response'),
    submittedAt: ms('submitted_at'),
    deliveredAt: ms('delivered_at'),
    firstOpenedAt: ms('first_opened_at'),
    firstClickedAt: ms('first_clicked_at'),
    openCount: integer('open_count').notNull().default(0),
    clickCount: integer('click_count').notNull().default(0),
    createdAt: createdAt(),
  },
  (t) => [
    index('recipient_email').on(t.emailId),
    index('recipient_provider').on(t.providerMessageId),
    index('recipient_address').on(t.organizationId, t.projectId, t.address),
  ],
)

export const sendAttempt = sqliteTable(
  'send_attempt',
  {
    id: text('id').primaryKey(),
    organizationId: organizationId(),
    emailId: text('email_id').notNull(),
    attempt: integer('attempt').notNull(),
    outcome: text('outcome', {
      enum: ['submitted', 'rejected', 'throttled', 'failed', 'uncertain'],
    }).notNull(),
    providerMessageId: text('provider_message_id'),
    errorCode: text('error_code'),
    errorMessage: text('error_message'),
    startedAt: ms('started_at').notNull(),
    latencyMs: integer('latency_ms').notNull(),
  },
  (t) => [uniqueIndex('send_attempt_number').on(t.emailId, t.attempt)],
)

export const emailEvent = sqliteTable(
  'email_event',
  {
    id: text('id').primaryKey(),
    organizationId: organizationId(),
    emailId: text('email_id').notNull(),
    recipientId: text('recipient_id'),
    type: text('type').notNull(),
    /** Dedupe key: SNS MessageId or a synthetic ID for platform stages. */
    sourceId: text('source_id').notNull(),
    providerAt: ms('provider_at'),
    ingestedAt: ms('ingested_at').notNull(),
    data: json<Record<string, unknown>>('data').notNull().default({}),
  },
  (t) => [
    uniqueIndex('email_event_source').on(t.sourceId, t.recipientId),
    index('email_event_email').on(t.emailId, t.providerAt),
  ],
)

/** Transactional outbox: written atomically with the email, published to Queues by dispatch. */
export const outbox = sqliteTable(
  'outbox',
  {
    emailId: text('email_id').primaryKey(),
    organizationId: organizationId(),
    stream: text('stream').notNull(),
    availableAt: ms('available_at').notNull(),
    publishedAt: ms('published_at'),
    attempts: integer('attempts').notNull().default(0),
  },
  (t) => [index('outbox_pending').on(t.publishedAt, t.availableAt)],
)

export const webhookDelivery = sqliteTable(
  'webhook_delivery',
  {
    id: text('id').primaryKey(),
    organizationId: organizationId(),
    endpointId: text('endpoint_id').notNull(),
    /** Stable event ID consumers dedupe on; replays reuse it. */
    eventId: text('event_id').notNull(),
    eventType: text('event_type').notNull(),
    emailId: text('email_id'),
    payload: json<Record<string, unknown>>('payload').notNull(),
    status: text('status', { enum: ['pending', 'succeeded', 'failed', 'dead'] }).notNull(),
    attempts: integer('attempts').notNull().default(0),
    nextAttemptAt: ms('next_attempt_at'),
    lastStatusCode: integer('last_status_code'),
    lastError: text('last_error'),
    lastLatencyMs: integer('last_latency_ms'),
    deliveredAt: ms('delivered_at'),
    createdAt: createdAt(),
  },
  (t) => [
    index('webhook_delivery_endpoint').on(t.organizationId, t.endpointId, t.id),
    index('webhook_delivery_email').on(t.emailId),
  ],
)

/** Immutable usage ledger (spec §16). Corrections are new rows, never updates. */
export const usageEntry = sqliteTable(
  'usage_entry',
  {
    id: text('id').primaryKey(),
    organizationId: organizationId(),
    projectId: text('project_id').notNull(),
    environmentId: text('environment_id').notNull(),
    kind: text('kind', { enum: ['submission', 'correction', 'storage', 'adjustment'] }).notNull(),
    quantity: integer('quantity').notNull(),
    /** Dedupe key: one submission unit per recipient submission. */
    dedupeKey: text('dedupe_key').notNull(),
    emailId: text('email_id'),
    recipientId: text('recipient_id'),
    period: text('period').notNull(),
    note: text('note'),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex('usage_entry_dedupe').on(t.dedupeKey),
    index('usage_entry_period').on(t.organizationId, t.period),
  ],
)
