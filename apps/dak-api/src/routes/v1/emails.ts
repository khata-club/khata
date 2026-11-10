import { SendEmailInput } from '@khata/dak-core'
import { and, eq, inArray } from 'drizzle-orm'
import { Hono, type Context } from 'hono'
import { z } from 'zod'

import type { AppEnv } from '../../app'
import { events } from '../../db'
import { gateName } from '../../durable/SendGate'
import { HttpError } from '../../lib/errors'
import { validate } from '../../lib/validate'
import { requireScope } from '../../middleware/api-key'
import { acceptEmail, type AcceptContext, type StoredPayload } from '../../sending/accept'
import { emitEmailWebhook } from '../../webhooks/emit'

export const emails = new Hono<AppEnv>()

const IDEMPOTENCY_KEY = /^[\x21-\x7e]{1,255}$/

function acceptContext(c: Context<AppEnv>): AcceptContext {
  const key = c.req.header('idempotency-key')
  if (key !== undefined && !IDEMPOTENCY_KEY.test(key)) {
    throw new HttpError(
      400,
      'invalid_idempotency_key',
      'Idempotency-Key must be 1–255 printable characters.',
    )
  }
  const traceparent = c.req.header('traceparent')
  return {
    env: c.env,
    db: c.get('db'),
    key: c.get('apiKey')!,
    idempotencyKey: key,
    traceparent:
      traceparent && /^[\da-f]{2}-[\da-f]{32}-[\da-f]{16}-[\da-f]{2}$/.test(traceparent)
        ? traceparent
        : undefined,
    waitUntil: (p) => c.executionCtx.waitUntil(p),
  }
}

emails.post('/', requireScope('emails:send'), validate('json', SendEmailInput), async (c) => {
  const { response, replayed } = await acceptEmail(acceptContext(c), c.req.valid('json'))
  if (replayed) c.header('idempotent-replayed', 'true')
  return c.json(response, 202)
})

/**
 * Up to 100 independent emails. Each item succeeds or fails on its own; with an
 * Idempotency-Key, item i uses `<key>:<i>` so a retried batch replays accepted items.
 */
emails.post(
  '/batch',
  requireScope('emails:send'),
  validate('json', z.object({ emails: z.array(z.unknown()).min(1).max(100) })),
  async (c) => {
    const ctx = acceptContext(c)
    const items = c.req.valid('json').emails
    const results = []
    for (const [index, raw] of items.entries()) {
      const parsed = SendEmailInput.safeParse(raw)
      if (!parsed.success) {
        results.push({
          index,
          error: {
            code: 'validation_failed',
            message: 'The email is invalid.',
            details: {
              issues: parsed.error.issues.map((i) => ({
                path: i.path.join('.'),
                message: i.message,
              })),
            },
          },
        })
        continue
      }
      try {
        const { response } = await acceptEmail(
          { ...ctx, idempotencyKey: ctx.idempotencyKey && `${ctx.idempotencyKey}:${index}` },
          parsed.data,
        )
        results.push({ index, ...response })
      } catch (err) {
        if (!(err instanceof HttpError)) throw err
        results.push({
          index,
          error: { code: err.code, message: err.message, details: err.details },
        })
      }
    }
    const failed = results.filter((r) => 'error' in r).length
    return c.json(
      { data: results, accepted: results.length - failed, failed },
      failed === results.length ? 422 : 200,
    )
  },
)

async function loadEmail(c: Context<AppEnv>) {
  const key = c.get('apiKey')!
  const email = await c
    .get('db')
    .events.findFirst(
      events.email,
      and(
        eq(events.email.id, c.req.param('id')!),
        eq(events.email.environmentId, key.environmentId),
      ),
    )
  if (!email) throw new HttpError(404, 'not_found', 'Email not found.')
  return email
}

emails.get('/:id', requireScope('emails:read'), async (c) => {
  const email = await loadEmail(c)
  const recipients = await c
    .get('db')
    .events.findMany(events.emailRecipient, eq(events.emailRecipient.emailId, email.id))
  return c.json({
    id: email.id,
    status: email.status,
    stream: email.stream,
    from: email.fromAddress,
    subject: email.subject,
    reference: email.reference,
    tags: email.tags,
    metadata: email.metadata,
    acceptedAt: new Date(email.acceptedAt).toISOString(),
    scheduledAt: email.scheduledAt ? new Date(email.scheduledAt).toISOString() : null,
    expiresAt: email.expiresAt ? new Date(email.expiresAt).toISOString() : null,
    recipients: recipients.map((r) => ({
      address: r.address,
      kind: r.kind,
      status: r.deliveryStatus,
      opened: r.firstOpenedAt !== null,
      clicked: r.firstClickedAt !== null,
    })),
  })
})

/**
 * Cancels queued or scheduled work. A conditional update races safely with dispatch, which
 * claims emails with the inverse condition; once handed to SES, mail cannot be recalled.
 */
emails.post('/:id/cancel', requireScope('emails:cancel'), async (c) => {
  const email = await loadEmail(c)
  const db = c.get('db').events
  const now = Date.now()
  const result = await db.update(
    events.email,
    { status: 'cancelled', cancelledAt: now },
    and(
      eq(events.email.id, email.id),
      inArray(events.email.status, ['accepted', 'queued', 'scheduled']),
    ),
  )
  if (!result.meta.changes) {
    throw new HttpError(
      409,
      'not_cancellable',
      `Email is ${email.status}; only queued or scheduled email can be cancelled.`,
    )
  }
  const pending = await db.findMany(
    events.emailRecipient,
    and(
      eq(events.emailRecipient.emailId, email.id),
      eq(events.emailRecipient.deliveryStatus, 'pending'),
    ),
  )
  await db.db.batch([
    db.update(
      events.emailRecipient,
      { deliveryStatus: 'cancelled', statusAt: now },
      and(
        eq(events.emailRecipient.emailId, email.id),
        eq(events.emailRecipient.deliveryStatus, 'pending'),
      ),
    ),
    db.delete(events.outbox, eq(events.outbox.emailId, email.id)),
  ])
  const key = c.get('apiKey')!
  await c.env.SEND_GATE.getByName(gateName(key.projectId, key.environmentId)).release({
    recipients: pending.length,
    now: email.acceptedAt,
  })
  c.executionCtx.waitUntil(
    emitEmailWebhook(c.env, c.get('db'), email, 'email.cancelled', { recipients: pending.length }),
  )
  return c.json({ id: email.id, status: 'cancelled' })
})

/**
 * Resend: an explicit new email linked to the original, with the same content and
 * recipients. Suppression, quota and verification are checked afresh.
 */
emails.post('/:id/resend', requireScope('emails:send'), async (c) => {
  const original = await loadEmail(c)
  const object = original.payloadKey ? await c.env.BLOBS.get(original.payloadKey) : null
  if (!object) {
    throw new HttpError(409, 'payload_unavailable', 'The original content is no longer retained.')
  }
  const payload = await object.json<StoredPayload>()
  const recipients = await c
    .get('db')
    .events.findMany(events.emailRecipient, eq(events.emailRecipient.emailId, original.id))
  const of = (k: 'to' | 'cc' | 'bcc') =>
    recipients.filter((r) => r.kind === k).map((r) => r.address)
  const input = SendEmailInput.parse({
    from: payload.from,
    to: of('to'),
    cc: of('cc').length ? of('cc') : undefined,
    bcc: of('bcc').length ? of('bcc') : undefined,
    replyTo: payload.replyTo.length ? payload.replyTo : undefined,
    subject: payload.subject,
    html: payload.html,
    text: payload.text,
    headers: payload.headers,
    attachments: payload.attachments.length ? payload.attachments : undefined,
    tags: original.tags,
    metadata: original.metadata,
    stream: original.stream,
    reference: original.reference ?? undefined,
  })
  const { response, replayed } = await acceptEmail(
    { ...acceptContext(c), resendOf: original.id },
    input,
  )
  if (replayed) c.header('idempotent-replayed', 'true')
  return c.json({ ...response, resendOf: original.id }, 202)
})
