import { env } from 'cloudflare:workers'
import { describe, expect, it } from 'vitest'

import { apiCaller, withProject } from './helpers'

describe('visual templates', () => {
  it('lists starters and creates a visual template from one', async () => {
    const ctx = await withProject()
    const base = `/api/projects/${ctx.projectId}/templates`
    const starters = await ctx.client.json<{ data: { id: string }[] }>(`${base}/starters`)
    expect(starters.body.data).toHaveLength(10)

    const created = await ctx.client.json<{ id: string }>(base, {
      method: 'POST',
      json: { alias: 'login-code', name: 'Login code', starter: 'otp' },
    })
    const t = await ctx.client.json<{
      editor: string
      versions: { html: string; blocks: { blocks: unknown[] } }[]
    }>(`${base}/${created.body.id}`)
    expect(t.body.editor).toBe('visual')
    expect(t.body.versions[0]!.blocks.blocks.length).toBeGreaterThan(2)
    expect(t.body.versions[0]!.html).toContain('role="presentation"')

    expect(
      (await ctx.client.json(`${base}/${created.body.id}/publish`, { method: 'POST' })).status,
    ).toBe(200)
    const api = await apiCaller(ctx.client, ctx.projectId, ctx.sandboxId)
    const sent = await api.call<{ id: string }>('POST', '/v1/emails', {
      from: 'auth@acme.dev',
      to: 'u@example.com',
      stream: 'authentication',
      template: { id: 'login-code', variables: { product: 'Acme', code: '135790' } },
    })
    expect(sent.status).toBe(202)
    const email = await env.DB_EVENTS.prepare('SELECT subject, payload_key FROM email WHERE id = ?')
      .bind(sent.body.id)
      .first<{ subject: string; payload_key: string }>()
    expect(email!.subject).toBe('135790 is your Acme code')
    const payload = await (await env.BLOBS.get(email!.payload_key))!.json<{ html: string }>()
    expect(payload.html).toContain('135790')
  })

  it('renders HTML from blocks on save and rejects invalid documents', async () => {
    const ctx = await withProject()
    const base = `/api/projects/${ctx.projectId}/templates`
    const { body } = await ctx.client.json<{ id: string }>(base, {
      method: 'POST',
      json: { alias: 'v', name: 'V', editor: 'visual' },
    })
    const draft = (blocks: unknown) =>
      ctx.client.json<{ checks: unknown[] }>(`${base}/${body.id}/draft`, {
        method: 'PUT',
        json: { subject: 'Hi', html: 'ignored', variables: [{ name: 'name' }], blocks },
      })
    expect((await draft({ blocks: [{ type: 'text', content: 'Hi {{ name }}' }] })).status).toBe(200)
    const t = await ctx.client.json<{ versions: { html: string }[] }>(`${base}/${body.id}`)
    expect(t.body.versions[0]!.html).toContain('Hi {{ name }}')
    expect(t.body.versions[0]!.html).not.toContain('ignored')

    const bad = await draft({
      blocks: [{ type: 'button', label: 'x', href: 'javascript:alert(1)' }],
    })
    expect(bad).toMatchObject({ status: 422, body: { error: { code: 'invalid_blocks' } } })
  })
})
