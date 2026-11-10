import { env } from 'cloudflare:workers'
import { afterEach, describe, expect, it } from 'vitest'

import { gateName } from '../src/durable/SendGate'
import { sweepOutbox } from '../src/jobs/outbox-sweep'
import { dispatchEmail } from '../src/sending/dispatch'
import { mockAws, type AwsMockState } from './aws-mock'
import { apiCaller, productionSender, sampleEmail, withProject } from './helpers'

let restore: (() => void) | undefined
afterEach(() => restore?.())

type SesBehaviour = 'ok' | 'timeout' | 'throttle' | 'reject' | '500'

function ses(behaviour: () => SesBehaviour) {
  const sends: { body: Record<string, unknown> }[] = []
  const m = mockAws({
    handle: (url, _init, body) => {
      if (!url.pathname.endsWith('/outbound-emails')) return undefined
      sends.push({ body: JSON.parse(body) })
      switch (behaviour()) {
        case 'ok':
          return Response.json({ MessageId: `ses-${sends.length}` })
        case 'timeout':
          throw new DOMException('The operation was aborted due to timeout', 'TimeoutError')
        case 'throttle':
          return Response.json(
            { message: 'slow down' },
            { status: 429, headers: { 'x-amzn-errortype': 'TooManyRequestsException' } },
          )
        case 'reject':
          return Response.json(
            { message: 'Email address is not verified.' },
            { status: 400, headers: { 'x-amzn-errortype': 'MessageRejected' } },
          )
        case '500':
          return Response.json(
            { message: 'boom' },
            { status: 500, headers: { 'x-amzn-errortype': 'InternalFailure' } },
          )
      }
    },
  } as Partial<AwsMockState>)
  restore = m.restore
  return sends
}

const q = (db: D1Database, sql: string, ...a: unknown[]) =>
  db
    .prepare(sql)
    .bind(...a)
    .all<Record<string, unknown>>()
    .then((r) => r.results)

async function setup() {
  const ctx = await withProject()
  const api = await productionSender(ctx)
  return { ...ctx, ...api }
}

async function accept(s: Awaited<ReturnType<typeof setup>>, over: Record<string, unknown> = {}) {
  const res = await s.call<{ id: string }>('POST', '/v1/emails', sampleEmail(over))
  expect(res.status).toBe(202)
  return {
    emailId: res.body.id,
    organizationId: s.organizationId,
    stream: (over.stream as 'transactional') ?? 'transactional',
  }
}

const recipients = (id: string) =>
  q(
    env.DB_EVENTS,
    'SELECT address, kind, delivery_status AS status, provider_message_id AS pid FROM email_recipient WHERE email_id = ? ORDER BY address',
    id,
  )
const emailStatus = async (id: string) =>
  (await q(env.DB_EVENTS, 'SELECT status FROM email WHERE id = ?', id))[0]?.status

describe('dispatch to SES', () => {
  it('submits raw MIME with BCC only in the envelope, per-stream configuration set and tags', async () => {
    const sends = ses(() => 'ok')
    const s = await setup()
    const msg = await accept(s, { cc: 'bo@example.com', bcc: 'secret@example.com' })
    expect(await dispatchEmail(env, msg)).toEqual({ action: 'ack', result: 'submitted' })

    expect(sends).toHaveLength(1)
    const body = sends[0]!.body as {
      Destination: Record<string, string[]>
      ConfigurationSetName: string
      EmailTags: { Name: string; Value: string }[]
      Content: { Raw: { Data: string } }
    }
    expect(body.Destination).toEqual({
      ToAddresses: ['ada@example.com'],
      CcAddresses: ['bo@example.com'],
      BccAddresses: ['secret@example.com'],
    })
    expect(body.ConfigurationSetName).toBe('dak-dev-transactional')
    expect(body.EmailTags).toContainEqual({ Name: 'dak_email_id', Value: msg.emailId })
    const raw = new TextDecoder().decode(
      Uint8Array.from(atob(body.Content.Raw.Data), (c) => c.charCodeAt(0)),
    )
    expect(raw).not.toContain('secret@example.com')
    expect(raw).toContain(`X-Dak-Email-ID: ${msg.emailId}`)

    expect(await emailStatus(msg.emailId)).toBe('sent')
    expect(
      (await recipients(msg.emailId)).every((r) => r.status === 'submitted' && r.pid === 'ses-1'),
    ).toBe(true)
    expect(await q(env.DB_EVENTS, 'SELECT * FROM outbox WHERE email_id = ?', msg.emailId)).toEqual(
      [],
    )
  })

  it('ignores duplicate queue deliveries (at-least-once)', async () => {
    const sends = ses(() => 'ok')
    const s = await setup()
    const msg = await accept(s)
    await dispatchEmail(env, msg)
    expect(await dispatchEmail(env, msg)).toEqual({ action: 'ack', result: 'already_sent' })
    expect(sends).toHaveLength(1)
  })

  it('records submission uncertain on timeout and never retries blindly', async () => {
    const sends = ses(() => 'timeout')
    const s = await setup()
    const msg = await accept(s)
    expect(await dispatchEmail(env, msg)).toEqual({ action: 'ack', result: 'uncertain' })
    expect((await recipients(msg.emailId)).map((r) => r.status)).toEqual(['submission_uncertain'])
    await dispatchEmail(env, msg)
    expect(sends).toHaveLength(1)
  })

  it('treats SES 5xx as uncertain', async () => {
    ses(() => '500')
    const s = await setup()
    const msg = await accept(s)
    expect((await dispatchEmail(env, msg)).result).toBe('uncertain')
  })

  it('does not resend after a worker died mid-submission (scenario 2)', async () => {
    const sends = ses(() => 'ok')
    const s = await setup()
    const msg = await accept(s)
    // Simulate a worker that claimed the email, recorded intent, then vanished.
    await env.DB_EVENTS.prepare("UPDATE email SET status = 'sending' WHERE id = ?")
      .bind(msg.emailId)
      .run()
    await env.DB_EVENTS.prepare(
      "INSERT INTO send_attempt (id, organization_id, email_id, attempt, outcome, started_at, latency_ms) VALUES ('att_x', ?, ?, 1, 'uncertain', 0, 0)",
    )
      .bind(s.organizationId, msg.emailId)
      .run()
    expect(await dispatchEmail(env, msg)).toEqual({ action: 'ack', result: 'recovered_uncertain' })
    expect(sends).toHaveLength(0)
    expect((await recipients(msg.emailId))[0]!.status).toBe('submission_uncertain')
  })

  it('resumes a claimed email that never reached SES', async () => {
    const sends = ses(() => 'ok')
    const s = await setup()
    const msg = await accept(s)
    await env.DB_EVENTS.prepare("UPDATE email SET status = 'sending' WHERE id = ?")
      .bind(msg.emailId)
      .run()
    expect((await dispatchEmail(env, msg)).result).toBe('submitted')
    expect(sends).toHaveLength(1)
  })

  it('retries throttling with backoff, then succeeds', async () => {
    let n = 0
    const sends = ses(() => (n++ === 0 ? 'throttle' : 'ok'))
    const s = await setup()
    const msg = await accept(s)
    const first = await dispatchEmail(env, msg)
    expect(first).toMatchObject({ action: 'retry', result: 'throttled' })
    expect(await emailStatus(msg.emailId)).toBe('queued')
    expect((await dispatchEmail(env, msg)).result).toBe('submitted')
    expect(sends).toHaveLength(2)
    const attempts = await q(
      env.DB_EVENTS,
      'SELECT attempt, outcome FROM send_attempt WHERE email_id = ? ORDER BY attempt',
      msg.emailId,
    )
    expect(attempts).toEqual([
      { attempt: 1, outcome: 'throttled' },
      { attempt: 2, outcome: 'submitted' },
    ])
  })

  it('marks rejections and releases their quota', async () => {
    ses(() => 'reject')
    const s = await setup()
    const gate = env.SEND_GATE.getByName(gateName(s.projectId, s.productionId))
    const msg = await accept(s)
    expect((await gate.usage()).reserved).toBe(1)
    expect((await dispatchEmail(env, msg)).result).toBe('rejected')
    expect(await emailStatus(msg.emailId)).toBe('failed')
    expect((await recipients(msg.emailId))[0]!.status).toBe('rejected')
    expect((await gate.usage()).reserved).toBe(0)
  })

  it('never sends expired time-sensitive mail', async () => {
    const sends = ses(() => 'ok')
    const s = await setup()
    const msg = await accept(s, { expiresAt: new Date(Date.now() + 60_000).toISOString() })
    expect(await dispatchEmail(env, msg, Date.now() + 120_000)).toEqual({
      action: 'ack',
      result: 'expired',
    })
    expect(sends).toHaveLength(0)
    expect((await recipients(msg.emailId))[0]!.status).toBe('expired')
  })

  it('blocks a recipient who complained after acceptance (scenario 4)', async () => {
    const sends = ses(() => 'ok')
    const s = await setup()
    const msg = await accept(s, { to: ['ada@example.com', 'ok@example.com'] })
    await env.DB.prepare(
      "INSERT INTO suppression (id, organization_id, project_id, email, reason, stream, created_at) VALUES (?, ?, ?, 'ada@example.com', 'complaint', '*', 0)",
    )
      .bind(`sup_${crypto.randomUUID().slice(0, 6)}`, s.organizationId, s.projectId)
      .run()
    await dispatchEmail(env, msg)
    expect(sends).toHaveLength(1)
    expect(
      (sends[0]!.body as { Destination: { ToAddresses: string[] } }).Destination.ToAddresses,
    ).toEqual(['ok@example.com'])
    expect((await recipients(msg.emailId)).map((r) => r.status)).toEqual([
      'suppressed',
      'submitted',
    ])
  })

  it('honours cancellation that wins the race', async () => {
    const sends = ses(() => 'ok')
    const s = await setup()
    const msg = await accept(s)
    await s.call('POST', `/v1/emails/${msg.emailId}/cancel`)
    expect(await dispatchEmail(env, msg)).toEqual({ action: 'ack', result: 'already_cancelled' })
    expect(sends).toHaveLength(0)
  })

  it('holds paused environments for later', async () => {
    ses(() => 'ok')
    const s = await setup()
    const msg = await accept(s)
    await s.client.json(`/api/projects/${s.projectId}/environments/${s.productionId}`, {
      method: 'PATCH',
      json: { paused: true },
    })
    expect(await dispatchEmail(env, msg)).toMatchObject({ action: 'retry', result: 'paused' })
    expect(await emailStatus(msg.emailId)).toBe('queued')
  })
})

describe('sandbox, sweeper and resend', () => {
  it('routes sandbox mail to the sink, never SES', async () => {
    const sends = ses(() => 'ok')
    const ctx = await withProject()
    const api = await apiCaller(ctx.client, ctx.projectId, ctx.sandboxId)
    const res = await api.call<{ id: string }>('POST', '/v1/emails', sampleEmail())
    expect(
      (
        await dispatchEmail(env, {
          emailId: res.body.id,
          organizationId: ctx.organizationId,
          stream: 'transactional',
        })
      ).result,
    ).toBe('sink')
    expect(sends).toHaveLength(0)
    expect((await recipients(res.body.id))[0]!.status).toBe('delivered')
  })

  it('publishes schedules beyond the queue delay limit once they come within range', async () => {
    ses(() => 'ok')
    const s = await setup()
    const at = Date.now() + 3 * 86_400_000
    const msg = await accept(s, { scheduledAt: new Date(at).toISOString() })
    const [before] = await q(
      env.DB_EVENTS,
      'SELECT published_at FROM outbox WHERE email_id = ?',
      msg.emailId,
    )
    expect(before!.published_at).toBeNull()

    expect((await sweepOutbox(env)).published).toBe(0)
    const later = await sweepOutbox(env, at - 3_600_000)
    expect(later.published).toBeGreaterThanOrEqual(1)
    const [after] = await q(
      env.DB_EVENTS,
      'SELECT published_at FROM outbox WHERE email_id = ?',
      msg.emailId,
    )
    expect(after!.published_at).not.toBeNull()
  })

  it('resends as a new linked email with fresh checks', async () => {
    ses(() => 'ok')
    const s = await setup()
    const msg = await accept(s, { bcc: 'b@example.com' })
    const res = await s.call<{ id: string; resendOf: string; recipients: { kind: string }[] }>(
      'POST',
      `/v1/emails/${msg.emailId}/resend`,
    )
    expect(res.status).toBe(202)
    expect(res.body.id).not.toBe(msg.emailId)
    expect(res.body.resendOf).toBe(msg.emailId)
    expect(res.body.recipients.map((r) => r.kind)).toEqual(['to', 'bcc'])
    const [row] = await q(env.DB_EVENTS, 'SELECT resend_of FROM email WHERE id = ?', res.body.id)
    expect(row!.resend_of).toBe(msg.emailId)
  })
})
