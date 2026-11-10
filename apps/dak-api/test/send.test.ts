import { env } from 'cloudflare:workers'
import { describe, expect, it } from 'vitest'

import { gateName } from '../src/durable/SendGate'
import { apiCaller, sampleEmail, withProject } from './helpers'

type Accepted = {
  id: string
  status: string
  recipients: { address: string; kind: string; status: string }[]
}

async function sandbox() {
  const ctx = await withProject()
  const api = await apiCaller(ctx.client, ctx.projectId, ctx.sandboxId)
  return { ...ctx, ...api }
}

const row = (db: D1Database, sql: string, ...args: unknown[]) =>
  db
    .prepare(sql)
    .bind(...args)
    .first<Record<string, unknown>>()

describe('POST /v1/emails', () => {
  it('durably accepts: email, recipients, outbox and pinned payload before 202', async () => {
    const s = await sandbox()
    const res = await s.call<Accepted>(
      'POST',
      '/v1/emails',
      sampleEmail({ cc: 'Bo@Example.com', bcc: ['ada@example.com', 'eve@example.com'] }),
    )
    expect(res.status).toBe(202)
    expect(res.body.id).toMatch(/^em_/)
    expect(res.body.status).toBe('queued')
    // Deduplicated across to/cc/bcc, first occurrence wins.
    expect(res.body.recipients.map((r) => [r.address, r.kind])).toEqual([
      ['ada@example.com', 'to'],
      ['bo@example.com', 'cc'],
      ['eve@example.com', 'bcc'],
    ])

    const email = await row(env.DB_EVENTS, 'SELECT * FROM email WHERE id = ?', res.body.id)
    expect(email).toMatchObject({
      status: 'queued',
      stream: 'transactional',
      from_address: 'hello@acme.dev',
    })
    expect(
      await row(
        env.DB_EVENTS,
        'SELECT count(*) AS n FROM email_recipient WHERE email_id = ?',
        res.body.id,
      ),
    ).toEqual({ n: 3 })
    expect(
      await row(env.DB_EVENTS, 'SELECT email_id FROM outbox WHERE email_id = ?', res.body.id),
    ).toBeTruthy()
    const payload = await env.BLOBS.get(String(email!.payload_key))
    expect(await payload!.json()).toMatchObject({
      from: 'Acme <hello@acme.dev>',
      subject: 'Your code',
      html: '<p>123456</p>',
    })
  })

  it('reads back the email with emails:read', async () => {
    const s = await sandbox()
    const { body } = await s.call<Accepted>(
      'POST',
      '/v1/emails',
      sampleEmail({ reference: 'order-42' }),
    )
    const got = await s.call<{ id: string; reference: string; recipients: unknown[] }>(
      'GET',
      `/v1/emails/${body.id}`,
    )
    expect(got.body).toMatchObject({ id: body.id, reference: 'order-42' })
  })

  it('returns field-level validation errors', async () => {
    const s = await sandbox()
    const res = await s.call<{ error: { code: string } }>('POST', '/v1/emails', {
      from: 'x@acme.dev',
      to: 'y@z.dev',
    })
    expect(res.status).toBe(422)
    const bad = await s.call<{ error: { code: string } }>(
      'POST',
      '/v1/emails',
      sampleEmail({ to: 'not-an-address' }),
    )
    expect(bad.body.error.code).toBe('invalid_recipient')
  })

  it('requires a verified domain and enabled sending outside the sandbox', async () => {
    const ctx = await withProject()
    const prod = await apiCaller(ctx.client, ctx.projectId, ctx.productionId)
    expect((await prod.call('POST', '/v1/emails', sampleEmail())).body).toMatchObject({
      error: { code: 'sending_disabled' },
    })
    await ctx.client.json(`/api/projects/${ctx.projectId}/environments/${ctx.productionId}`, {
      method: 'PATCH',
      json: { sendingEnabled: true },
    })
    expect((await prod.call('POST', '/v1/emails', sampleEmail())).body).toMatchObject({
      error: { code: 'domain_not_verified' },
    })
  })

  it('refuses paused environments', async () => {
    const s = await sandbox()
    await s.client.json(`/api/projects/${s.projectId}/environments/${s.sandboxId}`, {
      method: 'PATCH',
      json: { paused: true, pauseReason: 'incident' },
    })
    const res = await s.call('POST', '/v1/emails', sampleEmail())
    expect(res).toMatchObject({ status: 423, body: { error: { code: 'environment_paused' } } })
  })

  it('needs the emails:send scope', async () => {
    const ctx = await withProject()
    const readOnly = await apiCaller(ctx.client, ctx.projectId, ctx.sandboxId, ['emails:read'])
    expect((await readOnly.call('POST', '/v1/emails', sampleEmail())).status).toBe(403)
  })
})

describe('idempotency (spec §5, acceptance scenario 1)', () => {
  it('replays the original result for the same key and payload', async () => {
    const s = await sandbox()
    const h = { 'idempotency-key': 'order-1-receipt' }
    const a = await s.call<Accepted>('POST', '/v1/emails', sampleEmail(), h)
    const b = await s.call<Accepted>(
      'POST',
      '/v1/emails',
      { ...sampleEmail(), subject: 'Your code' },
      h,
    )
    expect(b.status).toBe(202)
    expect(b.body.id).toBe(a.body.id)
    expect(b.headers.get('idempotent-replayed')).toBe('true')
  })

  it('conflicts when the payload changes', async () => {
    const s = await sandbox()
    const h = { 'idempotency-key': 'k-change' }
    await s.call('POST', '/v1/emails', sampleEmail(), h)
    const res = await s.call('POST', '/v1/emails', sampleEmail({ subject: 'Different' }), h)
    expect(res).toMatchObject({ status: 409, body: { error: { code: 'idempotency_conflict' } } })
  })

  it('creates exactly one email under concurrent requests with one key', async () => {
    const s = await sandbox()
    const h = { 'idempotency-key': 'concurrent-1' }
    const results = await Promise.all(
      Array.from({ length: 8 }, () => s.call<Accepted>('POST', '/v1/emails', sampleEmail(), h)),
    )
    const ids = new Set(results.filter((r) => r.status === 202).map((r) => r.body.id))
    expect(ids.size).toBe(1)
    for (const r of results) expect([202, 409]).toContain(r.status)
    const count = await row(
      env.DB_EVENTS,
      'SELECT count(*) AS n FROM email WHERE idempotency_key = ?',
      'concurrent-1',
    )
    expect(count).toEqual({ n: 1 })
  })
})

describe('suppression, quota and rate limits', () => {
  it('suppresses blocked recipients at acceptance and skips the outbox when none remain', async () => {
    const s = await sandbox()
    await env.DB.prepare(
      "INSERT INTO suppression (id, organization_id, project_id, email, reason, stream, created_at) VALUES ('sup_1', ?, ?, 'ada@example.com', 'complaint', '*', 0)",
    )
      .bind(s.organizationId, s.projectId)
      .run()
    const res = await s.call<Accepted>('POST', '/v1/emails', sampleEmail())
    expect(res.body.status).toBe('suppressed')
    expect(res.body.recipients[0]!.status).toBe('suppressed')
    expect(
      await row(env.DB_EVENTS, 'SELECT * FROM outbox WHERE email_id = ?', res.body.id),
    ).toBeNull()

    const mixed = await s.call<Accepted>(
      'POST',
      '/v1/emails',
      sampleEmail({ to: ['ada@example.com', 'ok@example.com'] }),
    )
    expect(mixed.body.status).toBe('queued')
    expect(mixed.body.recipients.map((r) => r.status)).toEqual(['suppressed', 'pending'])
  })

  it('never exceeds a hard cap under concurrent reservations (scenario 9)', async () => {
    const s = await sandbox()
    await env.SEND_GATE.getByName(gateName(s.projectId, s.sandboxId)).configure({
      monthlyRecipientCap: 3,
    })
    const results = await Promise.all(
      Array.from({ length: 8 }, (_, i) =>
        s.call('POST', '/v1/emails', sampleEmail({ to: `u${i}@example.com` })),
      ),
    )
    expect(results.filter((r) => r.status === 202)).toHaveLength(3)
    expect(
      results
        .filter((r) => r.status === 429)
        .every((r) => (r.body as { error: { code: string } }).error.code === 'quota_exceeded'),
    ).toBe(true)
  })

  it('rate-limits per stream with Retry-After, leaving other streams unaffected', async () => {
    const s = await sandbox()
    await env.SEND_GATE.getByName(gateName(s.projectId, s.sandboxId)).configure({
      ratePerSecond: { authentication: 50, transactional: 40, notifications: 20, marketing: 1 },
    })
    const mk = () => s.call('POST', '/v1/emails', sampleEmail({ stream: 'marketing' }))
    const statuses = [(await mk()).status, (await mk()).status]
    const limited = await mk()
    expect(statuses).toEqual([202, 202])
    expect(limited.status).toBe(429)
    expect(Number(limited.headers.get('retry-after'))).toBeGreaterThanOrEqual(1)
    expect(
      (await s.call('POST', '/v1/emails', sampleEmail({ stream: 'authentication' }))).status,
    ).toBe(202)
  })
})

describe('batch and cancellation', () => {
  it('reports partial failures per item', async () => {
    const s = await sandbox()
    const res = await s.call<{
      accepted: number
      failed: number
      data: { index: number; id?: string; error?: { code: string } }[]
    }>('POST', '/v1/emails/batch', {
      emails: [sampleEmail(), { from: 'bad' }, sampleEmail({ to: 'nope' })],
    })
    expect(res.status).toBe(200)
    expect(res.body.accepted).toBe(1)
    expect(res.body.data.map((d) => d.error?.code ?? 'ok')).toEqual([
      'ok',
      'validation_failed',
      'invalid_recipient',
    ])
  })

  it('cancels scheduled email and releases its quota; cannot cancel twice', async () => {
    const s = await sandbox()
    const gate = env.SEND_GATE.getByName(gateName(s.projectId, s.sandboxId))
    const scheduledAt = new Date(Date.now() + 3 * 86_400_000).toISOString()
    const res = await s.call<Accepted>(
      'POST',
      '/v1/emails',
      sampleEmail({ scheduledAt, to: ['a@x.dev', 'b@x.dev'] }),
    )
    expect(res.body.status).toBe('scheduled')
    expect((await gate.usage()).reserved).toBe(2)

    const cancel = await s.call('POST', `/v1/emails/${res.body.id}/cancel`)
    expect(cancel.body).toEqual({ id: res.body.id, status: 'cancelled' })
    expect((await gate.usage()).reserved).toBe(0)
    expect((await s.call('POST', `/v1/emails/${res.body.id}/cancel`)).status).toBe(409)
    const got = await s.call<{ recipients: { status: string }[] }>(
      'GET',
      `/v1/emails/${res.body.id}`,
    )
    expect(got.body.recipients.map((r) => r.status)).toEqual(['cancelled', 'cancelled'])
  })

  it('never shows one tenant another tenant’s email (scenario 8)', async () => {
    const a = await sandbox()
    const b = await sandbox()
    const { body } = await a.call<Accepted>('POST', '/v1/emails', sampleEmail())
    expect((await b.call('GET', `/v1/emails/${body.id}`)).status).toBe(404)
    expect((await b.call('POST', `/v1/emails/${body.id}/cancel`)).status).toBe(404)
  })
})
