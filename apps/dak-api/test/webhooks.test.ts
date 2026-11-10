import { verifyWebhook } from '@khata/dak-core'
import { env } from 'cloudflare:workers'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { dispatchEmail } from '../src/sending/dispatch'
import { deliverWebhook } from '../src/webhooks/deliver'
import { webhookUrlProblem } from '../src/webhooks/url'
import { apiCaller, sampleEmail, signUpWithOrg, withProject } from './helpers'

interface Captured {
  url: string
  headers: Headers
  body: string
}
let captured: Captured[] = []
let respond: () => Response = () => new Response('ok')

beforeEach(() => {
  captured = []
  respond = () => new Response('ok')
  const real = globalThis.fetch
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const req = new Request(input as RequestInfo, init)
    if (new URL(req.url).hostname.endsWith('hooks.example.com')) {
      captured.push({ url: req.url, headers: req.headers, body: await req.text() })
      return respond()
    }
    return real(input as RequestInfo, init)
  })
})
afterEach(() => vi.restoreAllMocks())

const q = <T = Record<string, unknown>>(sql: string, ...a: unknown[]) =>
  env.DB_EVENTS.prepare(sql)
    .bind(...a)
    .all<T>()
    .then((r) => r.results)

async function setup(eventTypes = ['*']) {
  const ctx = await withProject()
  const created = await ctx.client.json<{ id: string; secret: string }>(
    `/api/projects/${ctx.projectId}/webhooks`,
    {
      method: 'POST',
      json: { url: 'https://hooks.example.com/dak', environmentId: ctx.sandboxId, eventTypes },
    },
  )
  expect(created.status).toBe(201)
  const api = await apiCaller(ctx.client, ctx.projectId, ctx.sandboxId)
  return { ...ctx, ...api, webhookId: created.body.id, secret: created.body.secret }
}

async function sendAndDispatch(
  s: Awaited<ReturnType<typeof setup>>,
  over: Record<string, unknown> = {},
) {
  const res = await s.call<{ id: string }>('POST', '/v1/emails', sampleEmail(over))
  await new Promise((r) => setTimeout(r, 50))
  await dispatchEmail(env, {
    emailId: res.body.id,
    organizationId: s.organizationId,
    stream: 'transactional',
  })
  return res.body.id
}

async function deliverAll(org: string) {
  const rows = await q<{ id: string }>(
    "SELECT id FROM webhook_delivery WHERE organization_id = ? AND status IN ('pending','failed')",
    org,
  )
  for (const r of rows) await deliverWebhook(env, { deliveryId: r.id, organizationId: org })
}

describe('webhook URLs', () => {
  it('allows only public https destinations', () => {
    expect(webhookUrlProblem('https://hooks.example.com/x')).toBeNull()
    for (const bad of [
      'http://hooks.example.com',
      'https://localhost/x',
      'https://10.1.2.3/',
      'https://169.254.169.254/latest',
      'https://[::1]/',
      'https://user:pw@x.com',
      'https://intranet/',
    ]) {
      expect(webhookUrlProblem(bad)).not.toBeNull()
    }
  })
})

describe('webhooks', () => {
  it('creates endpoints with a one-time secret', async () => {
    const s = await setup()
    expect(s.secret).toMatch(/^whsec_/)
    const list = await s.client.json<{ data: Record<string, unknown>[] }>(
      `/api/projects/${s.projectId}/webhooks`,
    )
    expect(list.body.data[0]).not.toHaveProperty('secretEnc')
    expect(JSON.stringify(list.body)).not.toContain(s.secret)
  })

  it('delivers signed lifecycle events that consumers can verify', async () => {
    const s = await setup()
    const emailId = await sendAndDispatch(s)
    await deliverAll(s.organizationId)
    const types = new Set<string>()
    for (const c of captured) {
      const payload = await verifyWebhook(s.secret, c.body, c.headers)
      expect(payload.data).toMatchObject({ emailId, environmentId: s.sandboxId })
      expect(c.body).not.toContain('<p>123456</p>')
      types.add(payload.type)
    }
    expect([...types].sort()).toEqual(['email.accepted', 'email.delivered'])
    const rows = await q<{ status: string }>(
      'SELECT status FROM webhook_delivery WHERE email_id = ?',
      emailId,
    )
    expect(rows.every((r) => r.status === 'succeeded')).toBe(true)
  })

  it('respects event subscriptions', async () => {
    const s = await setup(['email.bounced'])
    await sendAndDispatch(s, { to: 'bounce@simulator.dak.dev' })
    await deliverAll(s.organizationId)
    const types = await Promise.all(
      captured.map(async (c) => (await verifyWebhook(s.secret, c.body, c.headers)).type),
    )
    expect(types).toEqual(['email.bounced'])
  })

  it('retries failures with backoff and gives up as dead', async () => {
    respond = () => new Response('nope', { status: 500 })
    const s = await setup(['email.accepted'])
    await s.call('POST', '/v1/emails', sampleEmail())
    await new Promise((r) => setTimeout(r, 50))
    const [d] = await q<{ id: string }>(
      'SELECT id FROM webhook_delivery WHERE organization_id = ?',
      s.organizationId,
    )
    const first = await deliverWebhook(env, { deliveryId: d!.id, organizationId: s.organizationId })
    expect(first).toMatchObject({ action: 'retry' })
    let last
    for (let i = 0; i < 12; i++)
      last = await deliverWebhook(env, { deliveryId: d!.id, organizationId: s.organizationId })
    expect(last).toEqual({ action: 'ack', result: 'already_dead' })
    const [row] = await q<{ status: string; attempts: number; last_status_code: number }>(
      'SELECT status, attempts, last_status_code FROM webhook_delivery WHERE id = ?',
      d!.id,
    )
    expect(row).toEqual({ status: 'dead', attempts: 10, last_status_code: 500 })
  })

  it('replays a delivery with the same event ID and never resends the email (scenario 7)', async () => {
    const s = await setup(['email.delivered'])
    const emailId = await sendAndDispatch(s)
    await deliverAll(s.organizationId)
    const [d] = await q<{ id: string; event_id: string }>(
      'SELECT id, event_id FROM webhook_delivery WHERE email_id = ?',
      emailId,
    )
    const emailsBefore = await q('SELECT id FROM email WHERE organization_id = ?', s.organizationId)

    const replay = await s.client.json<{ eventId: string }>(
      `/api/projects/${s.projectId}/webhooks/${s.webhookId}/deliveries/${d!.id}/replay`,
      { method: 'POST' },
    )
    expect(replay.body.eventId).toBe(d!.event_id)
    captured = []
    await deliverWebhook(env, { deliveryId: d!.id, organizationId: s.organizationId })
    expect(captured[0]!.headers.get('webhook-id')).toBe(d!.event_id)
    expect(await q('SELECT id FROM email WHERE organization_id = ?', s.organizationId)).toEqual(
      emailsBefore,
    )
    const recipients = await q<{ s: string }>(
      'SELECT delivery_status AS s FROM email_recipient WHERE email_id = ?',
      emailId,
    )
    expect(recipients).toEqual([{ s: 'delivered' }])
  })

  it('signs with both secrets during rotation', async () => {
    const s = await setup(['email.accepted'])
    const rotated = await s.client.json<{ secret: string }>(
      `/api/projects/${s.projectId}/webhooks/${s.webhookId}/rotate`,
      { method: 'POST' },
    )
    await s.call('POST', '/v1/emails', sampleEmail())
    await new Promise((r) => setTimeout(r, 50))
    await deliverAll(s.organizationId)
    const c = captured[0]!
    expect(c.headers.get('webhook-signature')!.split(' ')).toHaveLength(2)
    await expect(verifyWebhook(s.secret, c.body, c.headers)).resolves.toBeTruthy()
    await expect(verifyWebhook(rotated.body.secret, c.body, c.headers)).resolves.toBeTruthy()
  })

  it('keeps endpoints and deliveries tenant-private', async () => {
    const s = await setup()
    const other = await signUpWithOrg('Mallory')
    const res = await other.client.json(
      `/api/projects/${s.projectId}/webhooks/${s.webhookId}/deliveries`,
    )
    expect(res.status).toBe(404)
  })

  it('rejects private destinations at creation', async () => {
    const ctx = await withProject()
    const res = await ctx.client.json(`/api/projects/${ctx.projectId}/webhooks`, {
      method: 'POST',
      json: { url: 'https://192.168.1.10/hook', environmentId: ctx.sandboxId, eventTypes: ['*'] },
    })
    expect(res.status).toBe(422)
  })
})
