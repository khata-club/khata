import {
  domainOf,
  MAX_MESSAGE_BYTES,
  MAX_RECIPIENTS,
  MAX_SCHEDULE_DAYS,
  newId,
  parseMailbox,
  type Attachment,
  type SendEmail,
} from '@khata/dak-core'
import { and, eq, gt, inArray, isNull, or } from 'drizzle-orm'

import type { ControlDb, EventsDb, Scoped } from '../db'
import { control, events } from '../db'
import { gateName, type ReserveResult } from '../durable/SendGate'
import { sha256Hex } from '../lib/crypto'
import { HttpError } from '../lib/errors'
import { enqueueEmail } from './queue'

export interface AcceptContext {
  env: Env
  db: { control: Scoped<ControlDb>; events: Scoped<EventsDb> }
  key: { id: string; projectId: string; environmentId: string; allowedDomains: string[] }
  idempotencyKey?: string
  traceparent?: string
  /** Explicit resend: the new email links to the original (spec §5). */
  resendOf?: string
  waitUntil: (p: Promise<unknown>) => void
  now?: number
}

export interface AcceptedRecipient {
  address: string
  kind: 'to' | 'cc' | 'bcc'
  status: 'pending' | 'suppressed'
}

export interface AcceptResponse {
  id: string
  status: 'queued' | 'scheduled' | 'suppressed'
  scheduledAt: string | null
  recipients: AcceptedRecipient[]
}

/** The pinned payload stored in R2; dispatch reads exactly this. */
export interface StoredPayload {
  from: string
  replyTo: string[]
  subject: string
  html?: string
  text?: string
  headers: Record<string, string>
  attachments: Attachment[]
}

const MAX_QUEUE_DELAY_S = 12 * 60 * 60

function list(v: string | string[] | undefined): string[] {
  return v === undefined ? [] : Array.isArray(v) ? v : [v]
}

/** Canonical JSON (sorted keys) so key order never changes the idempotency hash. */
export function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`
  if (value && typeof value === 'object') {
    return `{${Object.keys(value)
      .sort()
      .filter((k) => (value as Record<string, unknown>)[k] !== undefined)
      .map((k) => `${JSON.stringify(k)}:${canonical((value as Record<string, unknown>)[k])}`)
      .join(',')}}`
  }
  return JSON.stringify(value)
}

export function payloadKey(organizationId: string, emailId: string) {
  return `payloads/${organizationId}/${emailId}.json`
}

function estimateBytes(input: SendEmail): number {
  const attach = (input.attachments ?? []).reduce(
    (n, a) => n + Math.ceil((a.content.length * 3) / 4),
    0,
  )
  const headers = Object.entries(input.headers ?? {}).reduce(
    (n, [k, v]) => n + k.length + v.length + 4,
    0,
  )
  // Base64 transfer encoding grows attachments by a third on the wire.
  return (
    (input.html?.length ?? 0) +
    (input.text?.length ?? 0) +
    Math.ceil(attach * 1.37) +
    headers +
    2048
  )
}

/**
 * Validates and durably accepts one email. Returns only after the email, its recipients and
 * its outbox row are committed to D1 and the payload is in R2 (spec §5: 202 means durable
 * acceptance, not delivery).
 */
export async function acceptEmail(
  ctx: AcceptContext,
  input: SendEmail,
): Promise<{ response: AcceptResponse; replayed: boolean }> {
  const now = ctx.now ?? Date.now()
  const { db, key } = ctx
  const org = db.control.tenant.organizationId

  const environment = await db.control.findFirst(
    control.environment,
    eq(control.environment.id, key.environmentId),
  )
  if (!environment)
    throw new HttpError(
      403,
      'invalid_environment',
      'The environment for this key no longer exists.',
    )
  if (environment.pausedAt) {
    throw new HttpError(
      423,
      'environment_paused',
      `Sending is paused (${environment.pauseReason ?? 'manual'}).`,
    )
  }
  if (!environment.sendingEnabled) {
    throw new HttpError(403, 'sending_disabled', 'Enable sending for this environment first.')
  }
  const sandbox = environment.kind === 'sandbox'

  if (input.template) {
    throw new HttpError(422, 'templates_unavailable', 'Template sends are not available yet.')
  }

  // Sender identity.
  const from = parseMailbox(input.from)
  if (!from)
    throw new HttpError(422, 'invalid_from', 'from must be an address or "Name <address>".')
  const fromDomain = domainOf(from.address)
  if (
    key.allowedDomains.length &&
    !key.allowedDomains.some((d) => fromDomain === d || fromDomain.endsWith(`.${d}`))
  ) {
    throw new HttpError(403, 'domain_not_allowed', `This key cannot send from ${fromDomain}.`)
  }
  if (!sandbox) {
    const verified = await db.control.findMany(
      control.domain,
      and(eq(control.domain.projectId, key.projectId), eq(control.domain.status, 'verified')),
    )
    if (!verified.some((d) => fromDomain === d.name || fromDomain.endsWith(`.${d.name}`))) {
      throw new HttpError(
        403,
        'domain_not_verified',
        `Verify ${fromDomain} in this project before sending.`,
      )
    }
  }

  // Recipients: deduplicated across to/cc/bcc, first occurrence wins.
  const recipients: AcceptedRecipient[] = []
  const seen = new Set<string>()
  for (const kind of ['to', 'cc', 'bcc'] as const) {
    for (const raw of list(input[kind])) {
      const m = parseMailbox(raw)
      if (!m) throw new HttpError(422, 'invalid_recipient', `Invalid ${kind} address: ${raw}`)
      if (seen.has(m.address)) continue
      seen.add(m.address)
      recipients.push({ address: m.address, kind, status: 'pending' })
    }
  }
  if (!recipients.some((r) => r.kind === 'to'))
    throw new HttpError(422, 'invalid_recipient', 'At least one to address is required.')
  if (recipients.length > MAX_RECIPIENTS) {
    throw new HttpError(
      422,
      'too_many_recipients',
      `At most ${MAX_RECIPIENTS} recipients per email; use batch for more.`,
    )
  }
  const replyTo = list(input.replyTo).map((r) => {
    const m = parseMailbox(r)
    if (!m) throw new HttpError(422, 'invalid_reply_to', `Invalid replyTo address: ${r}`)
    return m.name ? `${m.name} <${m.address}>` : m.address
  })

  if (estimateBytes(input) > MAX_MESSAGE_BYTES) {
    throw new HttpError(
      413,
      'message_too_large',
      `Messages are limited to ${MAX_MESSAGE_BYTES / 1024 / 1024} MB.`,
    )
  }

  // Timing.
  const scheduledAt = input.scheduledAt ? Date.parse(input.scheduledAt) : null
  const expiresAt = input.expiresAt ? Date.parse(input.expiresAt) : null
  if (scheduledAt && scheduledAt > now + MAX_SCHEDULE_DAYS * 86_400_000) {
    throw new HttpError(
      422,
      'schedule_too_far',
      `Schedule at most ${MAX_SCHEDULE_DAYS} days ahead.`,
    )
  }
  if (expiresAt && expiresAt <= now)
    throw new HttpError(422, 'already_expired', 'expiresAt is in the past.')
  const deferred = scheduledAt !== null && scheduledAt > now + 1000

  // Safety suppression (all streams) and stream-scoped opt-outs.
  const suppressed = await db.control.findMany(
    control.suppression,
    and(
      eq(control.suppression.projectId, key.projectId),
      inArray(
        control.suppression.email,
        recipients.map((r) => r.address),
      ),
      inArray(control.suppression.stream, ['*', input.stream]),
      or(isNull(control.suppression.expiresAt), gt(control.suppression.expiresAt, now)),
    ),
  )
  const blocked = new Set(suppressed.map((s) => s.email))
  for (const r of recipients) if (blocked.has(r.address)) r.status = 'suppressed'
  const deliverable = recipients.filter((r) => r.status === 'pending').length

  // Idempotency, rate limit and quota in one serialized step.
  const emailId = newId('email', now)
  const gate = ctx.env.SEND_GATE.getByName(gateName(key.projectId, key.environmentId))
  const reserved: ReserveResult = await gate.reserve({
    idempotencyKey: ctx.idempotencyKey,
    payloadHash: await sha256Hex(canonical(input)),
    emailId,
    stream: input.stream,
    recipients: deliverable,
    now,
  })
  switch (reserved.status) {
    case 'replay':
      return { response: JSON.parse(reserved.response) as AcceptResponse, replayed: true }
    case 'conflict':
      throw new HttpError(
        409,
        'idempotency_conflict',
        'This Idempotency-Key was used with a different payload.',
      )
    case 'in_progress':
      throw new HttpError(
        409,
        'idempotency_in_progress',
        'A request with this Idempotency-Key is still being processed.',
      )
    case 'rate_limited':
      throw new HttpError(429, 'rate_limited', 'Too many requests for this stream.', {
        retryAfterMs: reserved.retryAfterMs,
      })
    case 'quota_exceeded':
      throw new HttpError(
        429,
        'quota_exceeded',
        'The monthly sending cap for this environment is reached.',
        {
          cap: reserved.cap,
          used: reserved.used,
        },
      )
  }

  const status: AcceptResponse['status'] =
    deliverable === 0 ? 'suppressed' : deferred ? 'scheduled' : 'queued'
  const response: AcceptResponse = {
    id: emailId,
    status,
    scheduledAt: deferred ? new Date(scheduledAt!).toISOString() : null,
    recipients,
  }

  const payload: StoredPayload = {
    from: from.name ? `${from.name} <${from.address}>` : from.address,
    replyTo,
    subject: input.subject!,
    html: input.html,
    text: input.text,
    headers: input.headers ?? {},
    attachments: input.attachments ?? [],
  }
  const objectKey = payloadKey(org, emailId)
  const ev = db.events
  try {
    await ctx.env.BLOBS.put(objectKey, JSON.stringify(payload), {
      httpMetadata: { contentType: 'application/json' },
      customMetadata: { organizationId: org, emailId },
    })
    await ev.db.batch([
      ev.insert(events.email, {
        id: emailId,
        projectId: key.projectId,
        environmentId: key.environmentId,
        stream: input.stream,
        status,
        fromAddress: from.address,
        subject: input.subject!,
        payloadKey: objectKey,
        sizeBytes: estimateBytes(input),
        idempotencyKey: ctx.idempotencyKey ?? null,
        reference: input.reference ?? null,
        tags: input.tags ?? {},
        metadata: input.metadata ?? {},
        traceparent: ctx.traceparent ?? null,
        resendOf: ctx.resendOf ?? null,
        apiKeyId: key.id,
        scheduledAt: deferred ? scheduledAt : null,
        expiresAt,
        acceptedAt: now,
      }),
      ev.insert(
        events.emailRecipient,
        recipients.map((r) => ({
          id: newId('emailRecipient', now),
          emailId,
          projectId: key.projectId,
          address: r.address,
          kind: r.kind,
          deliveryStatus: r.status,
          statusAt: r.status === 'suppressed' ? now : null,
        })),
      ),
      ev.insert(events.emailEvent, {
        id: newId('emailEvent', now),
        emailId,
        type: 'accepted',
        sourceId: `accepted:${emailId}`,
        providerAt: now,
        ingestedAt: now,
        data: { recipients: recipients.length, suppressed: recipients.length - deliverable },
      }),
      ...(deliverable > 0
        ? [
            ev.insert(events.outbox, {
              emailId,
              stream: input.stream,
              availableAt: deferred ? scheduledAt! : now,
            }),
          ]
        : []),
    ])
  } catch (err) {
    await gate.release({
      idempotencyKey: ctx.idempotencyKey,
      recipients: deliverable,
      period: reserved.period,
    })
    ctx.waitUntil(ctx.env.BLOBS.delete(objectKey))
    console.error(
      JSON.stringify({ level: 'error', msg: 'accept failed', emailId, err: String(err) }),
    )
    throw new HttpError(503, 'accept_failed', 'The email was not accepted; it is safe to retry.')
  }
  await gate.commit(ctx.idempotencyKey, response)

  // Hand off to the stream queue now if possible; the outbox sweeper covers failures and
  // schedules beyond the queue's maximum delay.
  if (deliverable > 0) {
    const delay = deferred ? Math.ceil((scheduledAt! - now) / 1000) : 0
    if (delay <= MAX_QUEUE_DELAY_S) {
      ctx.waitUntil(
        enqueueEmail(ctx.env, ev, { emailId, organizationId: org, stream: input.stream }, delay),
      )
    }
  }
  return { response, replayed: false }
}
