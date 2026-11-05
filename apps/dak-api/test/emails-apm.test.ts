import { env } from 'cloudflare:workers'
import { describe, expect, it } from 'vitest'

import { percentile, summarize } from '../src/observability/metrics'
import { dispatchEmail } from '../src/sending/dispatch'
import { apiCaller, joinAs, sampleEmail, withProject } from './helpers'

async function sandboxWithMail() {
  const ctx = await withProject()
  const api = await apiCaller(ctx.client, ctx.projectId, ctx.sandboxId)
  const ids: string[] = []
  for (const [to, ref] of [
    ['success@simulator.dak.dev', 'order-1'],
    ['bounce@simulator.dak.dev', 'order-2'],
    ['ada@example.com', 'order-3'],
  ]) {
    const r = await api.call<{ id: string }>(
      'POST',
      '/v1/emails',
      sampleEmail({ to, reference: ref }),
    )
    await dispatchEmail(env, {
      emailId: r.body.id,
      organizationId: ctx.organizationId,
      stream: 'transactional',
    })
    ids.push(r.body.id)
  }
  return { ...ctx, ...api, ids }
}

describe('percentiles', () => {
  it('uses nearest rank', () => {
    const xs = Array.from({ length: 100 }, (_, i) => i + 1)
    expect([50, 95, 99].map((p) => percentile(xs, p))).toEqual([50, 95, 99])
    expect(summarize([])).toEqual({ count: 0, p50: null, p95: null, p99: null })
  })
})

describe('emails dashboard', () => {
  it('lists newest first and searches by ID, reference and exact recipient', async () => {
    const s = await sandboxWithMail()
    const base = `/api/projects/${s.projectId}/emails?environmentId=${s.sandboxId}`
    const all = await s.client.json<{ data: { id: string; outcome: string }[] }>(base)
    expect(all.body.data.map((d) => d.id)).toEqual([...s.ids].reverse())
    expect(all.body.data.map((d) => d.outcome)).toEqual(['delivered', 'bounced', 'delivered'])

    const byRecipient = await s.client.json<{ data: { id: string }[] }>(
      `${base}&q=BOUNCE@simulator.dak.dev`,
    )
    expect(byRecipient.body.data.map((d) => d.id)).toEqual([s.ids[1]])
    const byRef = await s.client.json<{ data: { id: string }[] }>(`${base}&q=order-3`)
    expect(byRef.body.data.map((d) => d.id)).toEqual([s.ids[2]])
    const byId = await s.client.json<{ data: { id: string }[] }>(`${base}&q=${s.ids[0]}`)
    expect(byId.body.data.map((d) => d.id)).toEqual([s.ids[0]])
    const partial = await s.client.json<{ data: unknown[] }>(`${base}&q=simulator`)
    expect(partial.body.data).toEqual([])
  })

  it('returns the trace with stages, attempts and provider events', async () => {
    const s = await sandboxWithMail()
    const res = await s.client.json<{
      timeline: { type: string; recipient: string | null }[]
      recipients: { status: string }[]
      stages: { queueMs: number | null }
      email: { idempotencyKey: unknown; payloadKey?: unknown }
    }>(`/api/projects/${s.projectId}/emails/${s.ids[1]}`)
    expect(res.body.timeline.map((t) => t.type)).toEqual([
      'accepted',
      'dispatch_started',
      'submitted',
      'bounce',
    ])
    expect(res.body.timeline.at(-1)!.recipient).toBe('bounce@simulator.dak.dev')
    expect(res.body.recipients[0]!.status).toBe('bounced')
    expect(res.body.stages.queueMs).toBeGreaterThanOrEqual(0)
    expect(res.body.email).not.toHaveProperty('payloadKey')
  })

  it('guards production bodies behind emailBody:read', async () => {
    const s = await sandboxWithMail()
    const dev = await joinAs(s.client, s.organizationId, 'developer')
    expect((await dev.json(`/api/projects/${s.projectId}/emails/${s.ids[0]}/content`)).status).toBe(
      200,
    )

    await env.DB_EVENTS.prepare('UPDATE email SET environment_id = ? WHERE id = ?')
      .bind(s.productionId, s.ids[0])
      .run()
    const denied = await dev.json(`/api/projects/${s.projectId}/emails/${s.ids[0]}/content`)
    expect(denied).toMatchObject({ status: 403 })
    const owner = await s.client.json<{ html: string }>(
      `/api/projects/${s.projectId}/emails/${s.ids[0]}/content`,
    )
    expect(owner.body.html).toBe('<p>123456</p>')
  })

  it('summarizes monitoring for the environment', async () => {
    const s = await sandboxWithMail()
    const m = await s.client.json<{
      throughput: { accepted: number; perHour: number[] }
      stages: Record<string, { count: number; p95: number | null }>
      outcomes: Record<string, number>
    }>(`/api/projects/${s.projectId}/monitoring?environmentId=${s.sandboxId}&hours=24`)
    expect(m.status).toBe(200)
    expect(m.body.throughput.accepted).toBe(3)
    expect(m.body.throughput.perHour.at(-1)).toBe(3)
    expect(m.body.stages.queue!.count).toBe(3)
    expect(m.body.outcomes).toMatchObject({ delivered: 2, bounced: 1 })
  })
})
