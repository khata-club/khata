import { env } from 'cloudflare:workers'
import { describe, expect, it } from 'vitest'

import { dispatchEmail } from '../src/sending/dispatch'
import { simulationFor, sinkObjectKey } from '../src/sending/sink'
import { apiCaller, sampleEmail, withProject } from './helpers'

async function sandboxSend(over: Record<string, unknown> = {}) {
  const ctx = await withProject()
  const api = await apiCaller(ctx.client, ctx.projectId, ctx.sandboxId)
  const res = await api.call<{ id: string }>('POST', '/v1/emails', sampleEmail(over))
  await dispatchEmail(env, {
    emailId: res.body.id,
    organizationId: ctx.organizationId,
    stream: 'transactional',
  })
  return { ...ctx, ...api, emailId: res.body.id }
}

const statuses = (emailId: string) =>
  env.DB_EVENTS.prepare(
    'SELECT address, delivery_status AS s, open_count AS o, click_count AS k FROM email_recipient WHERE email_id = ? ORDER BY address',
  )
    .bind(emailId)
    .all<{ address: string; s: string; o: number; k: number }>()
    .then((r) => r.results)

describe('test sink', () => {
  it('maps simulator addresses to outcomes', () => {
    expect(simulationFor('bounce@simulator.dak.dev').map((s) => s.type)).toEqual(['bounce'])
    expect(simulationFor('complaint+abc@simulator.dak.dev').map((s) => s.type)).toEqual([
      'delivery',
      'complaint',
    ])
    expect(simulationFor('bounce@example.com').map((s) => s.type)).toEqual(['delivery'])
  })

  it('simulates outcomes through the production event rules', async () => {
    const s = await sandboxSend({
      to: [
        'success@simulator.dak.dev',
        'bounce@simulator.dak.dev',
        'complaint@simulator.dak.dev',
        'click@simulator.dak.dev',
        'delay@simulator.dak.dev',
      ],
    })
    expect(await statuses(s.emailId)).toEqual([
      { address: 'bounce@simulator.dak.dev', s: 'bounced', o: 0, k: 0 },
      { address: 'click@simulator.dak.dev', s: 'delivered', o: 1, k: 1 },
      { address: 'complaint@simulator.dak.dev', s: 'complained', o: 0, k: 0 },
      { address: 'delay@simulator.dak.dev', s: 'delivered', o: 0, k: 0 },
      { address: 'success@simulator.dak.dev', s: 'delivered', o: 0, k: 0 },
    ])
    // Hard bounce and complaint created safety suppressions, as real events would.
    const sup = await env.DB.prepare(
      'SELECT email, reason FROM suppression WHERE project_id = ? ORDER BY email',
    )
      .bind(s.projectId)
      .all()
    expect(sup.results).toEqual([
      { email: 'bounce@simulator.dak.dev', reason: 'hard_bounce' },
      { email: 'complaint@simulator.dak.dev', reason: 'complaint' },
    ])
  })

  it('stores the rendered message and shows it in the dashboard', async () => {
    const s = await sandboxSend({ bcc: 'hidden@example.com', html: '<h1>Welcome</h1>' })
    const eml = await env.BLOBS.get(sinkObjectKey(s.organizationId, s.emailId))
    const raw = await eml!.text()
    expect(raw).toContain('X-Dak-Sink: true')
    expect(raw).not.toContain('hidden@example.com')

    const view = await s.client.json<{ html: string; subject: string }>(
      `/api/projects/${s.projectId}/sink/${s.emailId}`,
    )
    expect(view.body).toMatchObject({ html: '<h1>Welcome</h1>', subject: 'Your code' })
    const download = await s.client.fetch(
      `/api/projects/${s.projectId}/sink/${s.emailId}?format=eml`,
    )
    expect(download.headers.get('content-type')).toBe('message/rfc822')
  })

  it('never contacts SES', async () => {
    const calls: string[] = []
    const real = globalThis.fetch
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      calls.push(String(input instanceof Request ? input.url : input))
      return real(input, init)
    }) as typeof fetch
    try {
      await sandboxSend()
    } finally {
      globalThis.fetch = real
    }
    expect(calls.filter((u) => u.includes('amazonaws.com'))).toEqual([])
  })
})
