import { newId } from '@khata/dak-core'
import { and, desc, eq, gt, inArray, isNull, or } from 'drizzle-orm'

import { projectAws } from '../aws/project'
import { AwsError, sesV2 } from '../aws/ses'
import {
  control,
  databases,
  events,
  scoped,
  type ControlDb,
  type EventsDb,
  type Scoped,
} from '../db'
import { gateName } from '../durable/SendGate'
import type { StoredPayload } from './accept'
import { buildMime, base64Utf8 } from './mime'
import type { DispatchMessage } from './queue'
import { recordStage } from '../observability/metrics'
import { emitEmailWebhook } from '../webhooks/emit'
import { deliverToSink } from './sink'

/** What the queue consumer should do with the message. */
export type DispatchOutcome =
  { action: 'ack'; result: string } | { action: 'retry'; delaySeconds: number; result: string }

const SES_TIMEOUT_MS = 15_000
/** SES errors that mean "not sent, do not retry". */
const REJECTIONS = new Set([
  'MessageRejected',
  'MailFromDomainNotVerifiedException',
  'AccountSuspendedException',
  'SendingPausedException',
  'BadRequestException',
  'NotFoundException',
])
const THROTTLES = new Set([
  'TooManyRequestsException',
  'LimitExceededException',
  'Throttling',
  'ThrottlingException',
])

interface Ctx {
  env: Env
  db: { control: Scoped<ControlDb>; events: Scoped<EventsDb> }
  now: number
}

type Email = typeof events.email.$inferSelect

async function event(
  ctx: Ctx,
  emailId: string,
  type: string,
  data: Record<string, unknown>,
  recipientId?: string,
) {
  await ctx.db.events.db
    .insert(events.emailEvent)
    .values({
      id: newId('emailEvent', ctx.now),
      organizationId: ctx.db.events.tenant.organizationId,
      emailId,
      recipientId: recipientId ?? null,
      type,
      sourceId: `${type}:${emailId}:${ctx.now}`,
      providerAt: ctx.now,
      ingestedAt: ctx.now,
      data,
    })
    .onConflictDoNothing()
}

function hook(
  ctx: Ctx,
  email: Email,
  type: Parameters<typeof emitEmailWebhook>[3],
  data: Record<string, unknown> = {},
) {
  return emitEmailWebhook(ctx.env, ctx.db, email, type, data, { at: ctx.now })
}

async function release(ctx: Ctx, email: Email, recipients: number) {
  if (recipients <= 0) return
  await ctx.env.SEND_GATE.getByName(gateName(email.projectId, email.environmentId)).release({
    recipients,
    now: email.acceptedAt,
  })
}

/** Moves the still-pending recipients to a terminal status. Returns how many moved. */
async function settlePending(
  ctx: Ctx,
  email: Email,
  status: 'expired' | 'rejected' | 'cancelled' | 'failed',
) {
  const res = await ctx.db.events.update(
    events.emailRecipient,
    { deliveryStatus: status, statusAt: ctx.now },
    and(
      eq(events.emailRecipient.emailId, email.id),
      eq(events.emailRecipient.deliveryStatus, 'pending'),
    ),
  )
  return res.meta.changes ?? 0
}

async function finish(ctx: Ctx, emailId: string) {
  await ctx.db.events.delete(events.outbox, eq(events.outbox.emailId, emailId))
}

/**
 * Dispatches one accepted email. Safe under at-least-once delivery:
 * - a conditional claim (queued/scheduled → sending) means only one worker proceeds;
 * - an attempt row is written *before* calling SES, so a worker that dies after handoff
 *   leaves evidence, and the redelivered message records "submission uncertain" instead of
 *   sending a blind duplicate (spec §5, acceptance scenario 2).
 */
export async function dispatchEmail(
  env: Env,
  msg: DispatchMessage,
  now = Date.now(),
): Promise<DispatchOutcome> {
  const dbs = databases(env)
  const tenant = { organizationId: msg.organizationId }
  const ctx: Ctx = {
    env,
    now,
    db: { control: scoped(dbs.control, tenant), events: scoped(dbs.events, tenant) },
  }
  const ev = ctx.db.events

  const email = await ev.findFirst(events.email, eq(events.email.id, msg.emailId))
  if (!email) return { action: 'ack', result: 'missing' }
  if (['sent', 'cancelled', 'expired', 'failed', 'suppressed'].includes(email.status)) {
    await finish(ctx, email.id)
    return { action: 'ack', result: `already_${email.status}` }
  }
  if (email.scheduledAt && email.scheduledAt > now + 1000) {
    return {
      action: 'retry',
      delaySeconds: Math.min(43_200, Math.ceil((email.scheduledAt - now) / 1000)),
      result: 'early',
    }
  }

  if (email.status === 'sending') return recoverInFlight(ctx, email)

  const claimed = await ev.update(
    events.email,
    { status: 'sending' },
    and(
      eq(events.email.id, email.id),
      inArray(events.email.status, ['accepted', 'queued', 'scheduled']),
      isNull(events.email.cancelledAt),
    ),
  )
  if (!claimed.meta.changes) return { action: 'ack', result: 'not_claimed' }
  const queueWaitMs = now - (email.scheduledAt ?? email.acceptedAt)
  await event(ctx, email.id, 'dispatch_started', { queueWaitMs })
  recordStage(env, {
    organizationId: email.organizationId,
    projectId: email.projectId,
    environmentId: email.environmentId,
    stage: 'queue',
    stream: email.stream,
    latencyMs: queueWaitMs,
  })

  // Time-sensitive mail (OTPs) is never sent late.
  if (email.expiresAt && email.expiresAt <= now) {
    const n = await settlePending(ctx, email, 'expired')
    await ev.update(events.email, { status: 'expired' }, eq(events.email.id, email.id))
    await release(ctx, email, n)
    await event(ctx, email.id, 'expired', { expiresAt: email.expiresAt })
    await hook(ctx, email, 'email.expired', { expiresAt: new Date(email.expiresAt).toISOString() })
    await finish(ctx, email.id)
    return { action: 'ack', result: 'expired' }
  }

  const environment = await ctx.db.control.findFirst(
    control.environment,
    eq(control.environment.id, email.environmentId),
  )
  const project = await ctx.db.control.findFirst(
    control.project,
    eq(control.project.id, email.projectId),
  )
  if (!environment || !project) {
    await ev.update(events.email, { status: 'failed' }, eq(events.email.id, email.id))
    await release(ctx, email, await settlePending(ctx, email, 'failed'))
    await finish(ctx, email.id)
    return { action: 'ack', result: 'orphaned' }
  }
  if (environment.pausedAt || (!environment.sendingEnabled && environment.kind !== 'sandbox')) {
    await ev.update(events.email, { status: 'queued' }, eq(events.email.id, email.id))
    return { action: 'retry', delaySeconds: 300, result: 'paused' }
  }

  // Re-check suppression right before sending: a complaint or opt-out may have arrived since
  // acceptance (acceptance scenarios 4 and 5).
  const pending = await ev.findMany(
    events.emailRecipient,
    and(
      eq(events.emailRecipient.emailId, email.id),
      eq(events.emailRecipient.deliveryStatus, 'pending'),
    ),
  )
  const blocked = pending.length
    ? await ctx.db.control.findMany(
        control.suppression,
        and(
          eq(control.suppression.projectId, email.projectId),
          inArray(
            control.suppression.email,
            pending.map((r) => r.address),
          ),
          inArray(control.suppression.stream, ['*', email.stream]),
          or(isNull(control.suppression.expiresAt), gt(control.suppression.expiresAt, now)),
        ),
      )
    : []
  if (blocked.length) {
    const addrs = new Set(blocked.map((b) => b.email))
    const ids = pending.filter((r) => addrs.has(r.address)).map((r) => r.id)
    await ev.update(
      events.emailRecipient,
      { deliveryStatus: 'suppressed', statusAt: now },
      inArray(events.emailRecipient.id, ids),
    )
    await release(ctx, email, ids.length)
    await event(ctx, email.id, 'suppressed', {
      recipients: ids.length,
      reasons: [...new Set(blocked.map((b) => b.reason))],
    })
    await hook(ctx, email, 'email.suppressed', {
      recipients: blocked.map((b) => ({ address: b.email, reason: b.reason })),
    })
  }
  const live = pending.filter((r) => !blocked.some((b) => b.email === r.address))
  if (live.length === 0) {
    await ev.update(events.email, { status: 'suppressed' }, eq(events.email.id, email.id))
    await finish(ctx, email.id)
    return { action: 'ack', result: 'suppressed' }
  }

  const object = email.payloadKey ? await env.BLOBS.get(email.payloadKey) : null
  if (!object) {
    await ev.update(events.email, { status: 'failed' }, eq(events.email.id, email.id))
    await release(ctx, email, await settlePending(ctx, email, 'failed'))
    await event(ctx, email.id, 'failed', { reason: 'payload_missing' })
    await finish(ctx, email.id)
    return { action: 'ack', result: 'payload_missing' }
  }
  const payload = await object.json<StoredPayload>()

  if (environment.kind === 'sandbox') {
    await deliverToSink(ctx, email, payload, live)
    await finish(ctx, email.id)
    return { action: 'ack', result: 'sink' }
  }

  return submitToSes(ctx, email, project, payload, live)
}

async function submitToSes(
  ctx: Ctx,
  email: Email,
  project: typeof control.project.$inferSelect,
  payload: StoredPayload,
  live: (typeof events.emailRecipient.$inferSelect)[],
): Promise<DispatchOutcome> {
  const ev = ctx.db.events
  // Resolve credentials before recording intent: failing here means nothing was sent.
  let aws: Awaited<ReturnType<typeof projectAws>>
  try {
    aws = await projectAws(ctx.env, ctx.db.control, project)
  } catch (err) {
    await ev.update(events.email, { status: 'queued' }, eq(events.email.id, email.id))
    await event(ctx, email.id, 'dispatch_blocked', {
      reason: err instanceof Error ? err.message : String(err),
    })
    return { action: 'retry', delaySeconds: 300, result: 'aws_unavailable' }
  }
  const prior = await ev.findMany(events.sendAttempt, eq(events.sendAttempt.emailId, email.id))
  const attemptNo = prior.length + 1
  const attemptId = newId('sendAttempt', ctx.now)
  // Intent first: if this worker dies mid-call, the redelivery sees an "uncertain" attempt.
  await ev.insert(events.sendAttempt, {
    id: attemptId,
    emailId: email.id,
    attempt: attemptNo,
    outcome: 'uncertain',
    startedAt: ctx.now,
    latencyMs: 0,
  })

  const by = (k: 'to' | 'cc' | 'bcc') => live.filter((r) => r.kind === k).map((r) => r.address)
  const raw = buildMime({
    from: payload.from,
    // To/Cc headers show the intended recipients even when some were suppressed; BCC never.
    to: by('to').length ? by('to') : ['undisclosed-recipients:;'],
    cc: by('cc'),
    replyTo: payload.replyTo,
    subject: payload.subject,
    text: payload.text,
    html: payload.html,
    headers: { ...payload.headers, 'X-Dak-Email-ID': email.id },
    attachments: payload.attachments,
    messageId: `${email.id}@dak.khata.club`,
  })

  const started = Date.now()
  let outcome: 'submitted' | 'rejected' | 'throttled' | 'uncertain'
  let messageId: string | undefined
  let error: { code: string; message: string } | undefined
  try {
    const res = await sesV2<{ MessageId: string }>(
      aws.creds,
      'POST',
      '/outbound-emails',
      {
        FromEmailAddress: payload.from,
        Destination: { ToAddresses: by('to'), CcAddresses: by('cc'), BccAddresses: by('bcc') },
        ReplyToAddresses: payload.replyTo,
        Content: { Raw: { Data: base64Utf8(raw) } },
        ConfigurationSetName: `${aws.configurationSetPrefix}-${email.stream}`,
        EmailTags: [
          { Name: 'dak_email_id', Value: email.id },
          { Name: 'dak_org', Value: email.organizationId },
          { Name: 'dak_env', Value: email.environmentId },
        ],
      },
      { signal: AbortSignal.timeout(SES_TIMEOUT_MS) },
    )
    outcome = 'submitted'
    messageId = res.MessageId
  } catch (err) {
    if (err instanceof AwsError && err.status < 500 && THROTTLES.has(err.code))
      outcome = 'throttled'
    else if (
      err instanceof AwsError &&
      err.status < 500 &&
      (REJECTIONS.has(err.code) || err.status === 400)
    )
      outcome = 'rejected'
    else outcome = 'uncertain' // timeout, network failure or 5xx: SES may have accepted it.
    error = {
      code: err instanceof AwsError ? err.code : err instanceof Error ? err.name : 'Error',
      message: err instanceof Error ? err.message.slice(0, 500) : String(err),
    }
  }
  const latencyMs = Date.now() - started
  recordStage(ctx.env, {
    organizationId: email.organizationId,
    projectId: email.projectId,
    environmentId: email.environmentId,
    stage: 'provider',
    stream: email.stream,
    outcome,
    latencyMs,
  })
  await ev.update(
    events.sendAttempt,
    {
      outcome,
      providerMessageId: messageId ?? null,
      errorCode: error?.code ?? null,
      errorMessage: error?.message ?? null,
      latencyMs,
    },
    eq(events.sendAttempt.id, attemptId),
  )
  const liveIds = live.map((r) => r.id)
  const now = ctx.now

  switch (outcome) {
    case 'submitted':
      await ev.db.batch([
        ev.update(
          events.emailRecipient,
          {
            deliveryStatus: 'submitted',
            providerMessageId: messageId!,
            submittedAt: now,
            statusAt: now,
          },
          and(
            inArray(events.emailRecipient.id, liveIds),
            eq(events.emailRecipient.deliveryStatus, 'pending'),
          ),
        ),
        ev.update(events.email, { status: 'sent' }, eq(events.email.id, email.id)),
        ev.delete(events.outbox, eq(events.outbox.emailId, email.id)),
      ])
      await event(ctx, email.id, 'submitted', {
        providerMessageId: messageId,
        latencyMs,
        attempt: attemptNo,
      })
      await hook(ctx, email, 'email.submitted', { recipients: live.map((r) => r.address) })
      if (!project.retainBodies && email.payloadKey) await ctx.env.BLOBS.delete(email.payloadKey)
      return { action: 'ack', result: 'submitted' }

    case 'rejected': {
      const n = await settlePending(ctx, email, 'rejected')
      await ev.update(events.email, { status: 'failed' }, eq(events.email.id, email.id))
      await release(ctx, email, n)
      await event(ctx, email.id, 'rejected', { ...error, latencyMs })
      await hook(ctx, email, 'email.rejected', { reason: error?.message })
      await finish(ctx, email.id)
      return { action: 'ack', result: 'rejected' }
    }

    case 'throttled': {
      await ev.update(events.email, { status: 'queued' }, eq(events.email.id, email.id))
      await event(ctx, email.id, 'throttled', { ...error, attempt: attemptNo })
      const delay = Math.min(900, 15 * 2 ** Math.min(attemptNo - 1, 6))
      return { action: 'retry', delaySeconds: delay, result: 'throttled' }
    }

    case 'uncertain':
      await markUncertain(ctx, email, liveIds, error)
      return { action: 'ack', result: 'uncertain' }
  }
}

async function markUncertain(
  ctx: Ctx,
  email: Email,
  recipientIds: string[],
  error?: { code: string; message: string },
) {
  const ev = ctx.db.events
  await ev.db.batch([
    ev.update(
      events.emailRecipient,
      { deliveryStatus: 'submission_uncertain', statusAt: ctx.now },
      and(
        inArray(events.emailRecipient.id, recipientIds),
        eq(events.emailRecipient.deliveryStatus, 'pending'),
      ),
    ),
    ev.update(events.email, { status: 'sent' }, eq(events.email.id, email.id)),
    ev.delete(events.outbox, eq(events.outbox.emailId, email.id)),
  ])
  // Reconciled when SES events carrying dak_email_id arrive (Dak 13/22).
  await event(ctx, email.id, 'submission_uncertain', { ...error })
  await hook(ctx, email, 'email.submission_uncertain', {})
}

/**
 * A message for an email already marked `sending`: a previous worker claimed it and stopped.
 * If it recorded an attempt, the handoff may have happened, so never resend.
 */
async function recoverInFlight(ctx: Ctx, email: Email): Promise<DispatchOutcome> {
  const ev = ctx.db.events
  const [last] = await ev.findMany(events.sendAttempt, eq(events.sendAttempt.emailId, email.id), {
    orderBy: desc(events.sendAttempt.attempt),
    limit: 1,
  })
  if (last && last.outcome === 'uncertain') {
    const pending = await ev.findMany(
      events.emailRecipient,
      and(
        eq(events.emailRecipient.emailId, email.id),
        eq(events.emailRecipient.deliveryStatus, 'pending'),
      ),
    )
    await markUncertain(
      ctx,
      email,
      pending.map((r) => r.id),
      { code: 'WorkerInterrupted', message: 'Worker stopped during submission.' },
    )
    return { action: 'ack', result: 'recovered_uncertain' }
  }
  // Claimed but never attempted (or last attempt was throttled): safe to try again.
  await ev.update(
    events.email,
    { status: 'queued' },
    and(eq(events.email.id, email.id), eq(events.email.status, 'sending')),
  )
  return dispatchEmail(
    ctx.env,
    { emailId: email.id, organizationId: email.organizationId, stream: email.stream },
    ctx.now,
  )
}
