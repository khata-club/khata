import { and, desc, eq, inArray, lt, or } from 'drizzle-orm'
import { Hono, type Context } from 'hono'
import { z } from 'zod'

import type { AppEnv } from '../../app'
import { can } from '../../auth/permissions'
import { control, events } from '../../db'
import { HttpError } from '../../lib/errors'
import { validate } from '../../lib/validate'
import { requirePermission } from '../../middleware/session'
import type { StoredPayload } from '../../sending/accept'

/** Mounted at /api/projects/:projectId/emails. */
export const emailsDashboard = new Hono<AppEnv>()

const listQuery = z.object({
  environmentId: z.string(),
  status: z.string().optional(),
  stream: z.string().optional(),
  /** Email ID, provider message ID, reference or (exact) recipient address. */
  q: z.string().trim().max(320).optional(),
  before: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
})

emailsDashboard.get(
  '/',
  requirePermission({ email: ['read'] }),
  validate('query', listQuery),
  async (c) => {
    const projectId = c.req.param('projectId')!
    const query = c.req.valid('query')
    const db = c.get('db').events
    const e = events.email
    let ids: string[] | undefined
    if (query.q) {
      const term = query.q.toLowerCase()
      if (/^em_/i.test(query.q)) ids = [query.q]
      else {
        const r = events.emailRecipient
        // Recipient lookup is exact-match only (spec §8: authorized recipient lookup).
        const hits = await db.findMany(
          r,
          and(
            eq(r.projectId, projectId),
            or(eq(r.address, term), eq(r.providerMessageId, query.q)),
          ),
          { limit: 200 },
        )
        ids = hits.map((h) => h.emailId)
      }
    }
    const rows = await db.findMany(
      e,
      and(
        eq(e.projectId, projectId),
        eq(e.environmentId, query.environmentId),
        query.status ? eq(e.status, query.status as typeof e.$inferSelect.status) : undefined,
        query.stream ? eq(e.stream, query.stream as typeof e.$inferSelect.stream) : undefined,
        query.before ? lt(e.id, query.before) : undefined,
        ids
          ? or(
              inArray(e.id, ids.length ? ids : ['-']),
              query.q ? eq(e.reference, query.q) : undefined,
            )
          : undefined,
      ),
      { orderBy: desc(e.id), limit: query.limit + 1 },
    )
    const page = rows.slice(0, query.limit)
    const recipients = page.length
      ? await db.findMany(
          events.emailRecipient,
          inArray(
            events.emailRecipient.emailId,
            page.map((r) => r.id),
          ),
        )
      : []
    return c.json({
      data: page.map((m) => {
        const rs = recipients.filter((r) => r.emailId === m.id)
        return {
          id: m.id,
          status: m.status,
          stream: m.stream,
          from: m.fromAddress,
          subject: m.subject,
          reference: m.reference,
          acceptedAt: m.acceptedAt,
          recipients: rs.length,
          to: rs.find((r) => r.kind === 'to')?.address ?? null,
          outcome: summarizeOutcome(rs.map((r) => r.deliveryStatus)),
        }
      }),
      nextCursor: rows.length > query.limit ? page.at(-1)!.id : null,
    })
  },
)

/** Most significant recipient outcome for the list view. */
function summarizeOutcome(statuses: string[]): string {
  for (const s of [
    'complained',
    'bounced',
    'rejected',
    'submission_uncertain',
    'delayed',
    'submitted',
    'delivered',
    'suppressed',
    'pending',
    'cancelled',
    'expired',
  ]) {
    if (statuses.includes(s))
      return statuses.every((x) => x === s) ? s : s === 'delivered' ? 'delivered' : `${s}`
  }
  return statuses[0] ?? 'pending'
}

async function load(c: Context<AppEnv>) {
  const email = await c
    .get('db')
    .events.findFirst(
      events.email,
      and(
        eq(events.email.id, c.req.param('emailId')!),
        eq(events.email.projectId, c.req.param('projectId')!),
      ),
    )
  if (!email) throw new HttpError(404, 'not_found', 'Email not found.')
  return email
}

/**
 * The email's asynchronous trace (spec §8): acceptance → dispatch → submission → recipient
 * outcomes → webhook deliveries, with per-stage latency.
 */
emailsDashboard.get('/:emailId', requirePermission({ email: ['read'] }), async (c) => {
  const email = await load(c)
  const db = c.get('db').events
  const [recipients, attempts, evts, hooks] = await Promise.all([
    db.findMany(events.emailRecipient, eq(events.emailRecipient.emailId, email.id)),
    db.findMany(events.sendAttempt, eq(events.sendAttempt.emailId, email.id), {
      orderBy: events.sendAttempt.attempt,
    }),
    db.findMany(events.emailEvent, eq(events.emailEvent.emailId, email.id), {
      orderBy: events.emailEvent.providerAt,
    }),
    db.findMany(events.webhookDelivery, eq(events.webhookDelivery.emailId, email.id), {
      orderBy: events.webhookDelivery.id,
    }),
  ])
  const byRecipient = new Map(recipients.map((r) => [r.id, r.address]))
  const started = evts.find((e) => e.type === 'dispatch_started')
  const submitted = attempts.find((a) => a.outcome === 'submitted')
  const firstDelivered = recipients
    .map((r) => r.deliveredAt)
    .filter((x): x is number => !!x)
    .sort()[0]

  return c.json({
    email: {
      ...email,
      payloadKey: undefined,
      idempotencyKey: email.idempotencyKey ? '••••' : null,
    },
    recipients: recipients.map((r) => ({
      id: r.id,
      address: r.address,
      kind: r.kind,
      status: r.deliveryStatus,
      bounceType: r.bounceType,
      smtpResponse: r.smtpResponse,
      providerMessageId: r.providerMessageId,
      submittedAt: r.submittedAt,
      deliveredAt: r.deliveredAt,
      opens: r.openCount,
      clicks: r.clickCount,
    })),
    attempts: attempts.map((a) => ({
      attempt: a.attempt,
      outcome: a.outcome,
      latencyMs: a.latencyMs,
      startedAt: a.startedAt,
      providerMessageId: a.providerMessageId,
      error: a.errorCode ? `${a.errorCode}: ${a.errorMessage ?? ''}`.slice(0, 300) : null,
    })),
    timeline: evts.map((e) => ({
      id: e.id,
      type: e.type,
      at: e.providerAt ?? e.ingestedAt,
      ingestedAt: e.ingestedAt,
      recipient: e.recipientId ? byRecipient.get(e.recipientId) : null,
      data: e.data,
    })),
    webhooks: hooks.map((h) => ({
      id: h.id,
      eventType: h.eventType,
      status: h.status,
      attempts: h.attempts,
      lastStatusCode: h.lastStatusCode,
      lastLatencyMs: h.lastLatencyMs,
      deliveredAt: h.deliveredAt,
    })),
    stages: {
      queueMs: started ? ((started.data as { queueWaitMs?: number }).queueWaitMs ?? null) : null,
      providerMs: submitted?.latencyMs ?? null,
      deliveryMs:
        firstDelivered && submitted
          ? firstDelivered - (submitted.startedAt + submitted.latencyMs)
          : null,
      eventLagMs:
        evts
          .filter(
            (e) =>
              e.providerAt &&
              !e.type.includes('_') &&
              e.type !== 'accepted' &&
              e.type !== 'submitted',
          )
          .map((e) => e.ingestedAt - e.providerAt!)[0] ?? null,
    },
  })
})

/** Rendered content. Production bodies need `emailBody:read`; sandbox content is test data. */
emailsDashboard.get('/:emailId/content', requirePermission({ email: ['read'] }), async (c) => {
  const email = await load(c)
  const env = await c
    .get('db')
    .control.findFirst(control.environment, eq(control.environment.id, email.environmentId))
  if (env?.kind !== 'sandbox' && !can(c.get('member')!.role, { emailBody: ['read'] })) {
    throw new HttpError(403, 'forbidden', 'Viewing email content needs the email-body permission.')
  }
  const obj = email.payloadKey ? await c.env.BLOBS.get(email.payloadKey) : null
  if (!obj)
    throw new HttpError(404, 'content_unavailable', 'This email’s content is no longer retained.')
  const p = await obj.json<StoredPayload>()
  return c.json({
    subject: p.subject,
    from: p.from,
    html: p.html ?? null,
    text: p.text ?? null,
    attachments: p.attachments.map((a) => ({ filename: a.filename, contentType: a.contentType })),
  })
})
