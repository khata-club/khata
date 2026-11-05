import {
  isEngagement,
  newId,
  nextDeliveryStatus,
  type DeliveryStatus,
  type ProviderEventType,
} from '@khata/dak-core'
import { and, eq, gt, inArray, ne } from 'drizzle-orm'

import {
  control,
  databases,
  events,
  scoped,
  type ControlDb,
  type EventsDb,
  type Scoped,
} from '../db'

/** SES event publishing payload (the parts Dak uses). */
export interface SesEvent {
  eventType: string
  mail: {
    messageId: string
    timestamp: string
    destination: string[]
    tags?: Record<string, string[]>
  }
  bounce?: {
    bounceType: string
    bounceSubType?: string
    timestamp: string
    bouncedRecipients: { emailAddress: string; diagnosticCode?: string; status?: string }[]
  }
  complaint?: {
    timestamp: string
    complainedRecipients: { emailAddress: string }[]
    complaintFeedbackType?: string
  }
  delivery?: {
    timestamp: string
    recipients: string[]
    smtpResponse?: string
    processingTimeMillis?: number
  }
  deliveryDelay?: {
    timestamp: string
    delayType?: string
    delayedRecipients: { emailAddress: string; diagnosticCode?: string }[]
  }
  open?: { timestamp: string; userAgent?: string }
  click?: { timestamp: string; link: string; userAgent?: string }
  reject?: { reason: string }
  failure?: { errorMessage: string; templateName?: string }
}

export interface NormalizedEvent {
  type: ProviderEventType
  providerMessageId: string
  emailId?: string
  organizationId?: string
  at: number
  /** Lower-cased recipients the event applies to. */
  recipients: string[]
  bounceType?: string
  detail?: string
  link?: string
  /** Open/click on a multi-recipient message cannot be attributed to one person. */
  ambiguous?: boolean
}

const TYPES: Record<string, ProviderEventType> = {
  Send: 'send',
  Reject: 'reject',
  Bounce: 'bounce',
  Complaint: 'complaint',
  Delivery: 'delivery',
  DeliveryDelay: 'delivery_delay',
  RenderingFailure: 'rendering_failure',
  Open: 'open',
  Click: 'click',
}

export function normalizeSesEvent(e: SesEvent): NormalizedEvent | null {
  const type = TYPES[e.eventType]
  if (!type || !e.mail?.messageId) return null
  const lower = (xs: string[]) => xs.map((x) => x.toLowerCase())
  const all = lower(e.mail.destination ?? [])
  const at = (ts?: string) => (ts ? Date.parse(ts) : Date.parse(e.mail.timestamp))
  const base = {
    type,
    providerMessageId: e.mail.messageId,
    emailId: e.mail.tags?.dak_email_id?.[0],
    organizationId: e.mail.tags?.dak_org?.[0],
  }
  switch (type) {
    case 'bounce':
      return {
        ...base,
        at: at(e.bounce?.timestamp),
        recipients: lower(e.bounce?.bouncedRecipients.map((r) => r.emailAddress) ?? []),
        bounceType: e.bounce?.bounceType,
        detail: e.bounce?.bouncedRecipients[0]?.diagnosticCode,
      }
    case 'complaint':
      return {
        ...base,
        at: at(e.complaint?.timestamp),
        recipients: lower(e.complaint?.complainedRecipients.map((r) => r.emailAddress) ?? []),
        detail: e.complaint?.complaintFeedbackType,
      }
    case 'delivery':
      return {
        ...base,
        at: at(e.delivery?.timestamp),
        recipients: lower(e.delivery?.recipients ?? []),
        detail: e.delivery?.smtpResponse,
      }
    case 'delivery_delay':
      return {
        ...base,
        at: at(e.deliveryDelay?.timestamp),
        recipients: lower(e.deliveryDelay?.delayedRecipients.map((r) => r.emailAddress) ?? []),
        detail: e.deliveryDelay?.delayType,
      }
    case 'open':
      return { ...base, at: at(e.open?.timestamp), recipients: all, ambiguous: all.length > 1 }
    case 'click':
      return {
        ...base,
        at: at(e.click?.timestamp),
        recipients: all,
        link: e.click?.link,
        ambiguous: all.length > 1,
      }
    case 'reject':
      return { ...base, at: at(), recipients: all, detail: e.reject?.reason }
    case 'rendering_failure':
      return { ...base, at: at(), recipients: all, detail: e.failure?.errorMessage }
    default:
      return { ...base, at: at(), recipients: all }
  }
}

export interface EventQueueMessage {
  snsMessageId: string
  topicArn: string
  event: SesEvent
}

/** Soft-bounce policy (spec §7): repeated transient bounces suppress for a cooling-off period. */
export const SOFT_BOUNCE_LIMIT = 3
export const SOFT_BOUNCE_WINDOW_MS = 7 * 86_400_000

function topicAccount(arn: string) {
  return /^arn:aws[a-z-]*:sns:[a-z0-9-]+:(\d{12}):/.exec(arn)?.[1]
}

/**
 * Applies one SES event. Idempotent: each (SNS message, recipient) is recorded once, and
 * duplicates or out-of-order events cannot corrupt status (acceptance scenario 3).
 */
export async function processSesEvent(env: Env, msg: EventQueueMessage, ingestedAt = Date.now()) {
  const n = normalizeSesEvent(msg.event)
  if (!n || n.recipients.length === 0) return { applied: 0, reason: 'ignored' }
  const dbs = databases(env)

  // Resolve the tenant: our own tag first, else the provider message ID we stored.
  let organizationId = n.organizationId
  if (!organizationId) {
    const [r] = await dbs.events
      .select({ org: events.emailRecipient.organizationId })
      .from(events.emailRecipient)
      .where(eq(events.emailRecipient.providerMessageId, n.providerMessageId))
      .limit(1)
    organizationId = r?.org
  }
  if (!organizationId) return { applied: 0, reason: 'unknown_message' }

  // Events from a customer's own topic may only touch that customer's mail.
  const platformTopics = (env.DAK_SNS_TOPIC_ARNS ?? '').split(',').map((s) => s.trim())
  if (!platformTopics.includes(msg.topicArn)) {
    const account = topicAccount(msg.topicArn)
    const [conn] = await dbs.control
      .select({ org: control.awsConnection.organizationId })
      .from(control.awsConnection)
      .where(
        and(
          eq(control.awsConnection.accountId, account ?? '-'),
          eq(control.awsConnection.organizationId, organizationId),
        ),
      )
      .limit(1)
    if (!conn) return { applied: 0, reason: 'foreign_topic' }
  }

  const db = {
    control: scoped(dbs.control, { organizationId }),
    events: scoped(dbs.events, { organizationId }),
  }
  return applyNormalizedEvent(db, n, msg.snsMessageId, ingestedAt)
}

/**
 * Applies a normalized provider event to the tenant's recipients. Shared by SES ingestion and
 * the sandbox sink, so simulated outcomes exercise the exact production rules.
 */
export async function applyNormalizedEvent(
  db: { control: Scoped<ControlDb>; events: Scoped<EventsDb> },
  n: NormalizedEvent,
  sourceId: string,
  ingestedAt = Date.now(),
) {
  const organizationId = db.events.tenant.organizationId
  const r = events.emailRecipient
  const recipients = await db.events.findMany(
    r,
    and(
      n.emailId ? eq(r.emailId, n.emailId) : eq(r.providerMessageId, n.providerMessageId),
      inArray(r.address, n.recipients),
    ),
  )

  let applied = 0
  for (const rec of recipients) {
    const inserted = await db.events.db
      .insert(events.emailEvent)
      .values({
        id: newId('emailEvent', ingestedAt),
        organizationId,
        emailId: rec.emailId,
        recipientId: rec.id,
        type: n.type,
        sourceId,
        providerAt: n.at,
        ingestedAt,
        data: {
          ...(n.detail && { detail: n.detail }),
          ...(n.bounceType && { bounceType: n.bounceType }),
          ...(n.link && { link: n.link }),
          ...(n.ambiguous && { ambiguous: true }),
        },
      })
      .onConflictDoNothing()
      .returning({ id: events.emailEvent.id })
    if (inserted.length === 0) continue // duplicate delivery
    applied++

    if (isEngagement(n.type)) {
      await db.events.update(
        r,
        n.type === 'open'
          ? {
              openCount: rec.openCount + 1,
              firstOpenedAt: Math.min(rec.firstOpenedAt ?? n.at, n.at),
            }
          : {
              clickCount: rec.clickCount + 1,
              firstClickedAt: Math.min(rec.firstClickedAt ?? n.at, n.at),
            },
        eq(r.id, rec.id),
      )
      continue
    }

    const next = nextDeliveryStatus(
      { status: rec.deliveryStatus as DeliveryStatus, at: rec.statusAt },
      { type: n.type, at: n.at },
    )
    if (next) {
      await db.events.update(
        r,
        {
          deliveryStatus: next as typeof rec.deliveryStatus,
          statusAt: n.at,
          providerMessageId: rec.providerMessageId ?? n.providerMessageId,
          ...(next === 'delivered' && { deliveredAt: n.at, smtpResponse: n.detail ?? null }),
          ...(next === 'bounced' && {
            bounceType: n.bounceType ?? null,
            smtpResponse: n.detail ?? null,
          }),
        },
        eq(r.id, rec.id),
      )
    }
    await applySuppression(db, rec, n)
  }
  return { applied, reason: 'ok' }
}

/** Hard bounces and complaints suppress immediately, on every stream (spec §7). */
async function applySuppression(
  db: { control: Scoped<ControlDb>; events: Scoped<EventsDb> },
  rec: typeof events.emailRecipient.$inferSelect,
  n: NormalizedEvent,
) {
  let reason: 'hard_bounce' | 'complaint' | 'soft_bounce_policy' | undefined
  let expiresAt: number | null = null
  if (n.type === 'complaint') reason = 'complaint'
  else if (n.type === 'bounce' && n.bounceType === 'Permanent') reason = 'hard_bounce'
  else if (n.type === 'bounce') {
    const r = events.emailRecipient
    const recent = await db.events.findMany(
      r,
      and(
        eq(r.projectId, rec.projectId),
        eq(r.address, rec.address),
        eq(r.deliveryStatus, 'bounced'),
        ne(r.bounceType, 'Permanent'),
        gt(r.statusAt, n.at - SOFT_BOUNCE_WINDOW_MS),
      ),
      { limit: SOFT_BOUNCE_LIMIT },
    )
    if (recent.length >= SOFT_BOUNCE_LIMIT) {
      reason = 'soft_bounce_policy'
      expiresAt = n.at + SOFT_BOUNCE_WINDOW_MS
    }
  }
  if (!reason) return
  await db.control.db
    .insert(control.suppression)
    .values({
      id: newId('suppression'),
      organizationId: db.control.tenant.organizationId,
      projectId: rec.projectId,
      email: rec.address,
      reason,
      stream: '*',
      sourceEmailId: rec.emailId,
      expiresAt,
    })
    .onConflictDoNothing()
}
