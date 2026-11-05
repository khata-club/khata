import { env } from 'cloudflare:workers'
import { describe, expect, it } from 'vitest'

import { apiCaller, withProject } from './helpers'

async function setup() {
  const ctx = await withProject()
  const base = `/api/projects/${ctx.projectId}/templates`
  const created = await ctx.client.json<{ id: string }>(base, {
    method: 'POST',
    json: { alias: 'otp', name: 'Login code' },
  })
  expect(created.status).toBe(201)
  const t = `${base}/${created.body.id}`
  const draft = (
    html: string,
    variables: unknown[] = otpVars,
    subject = 'Your code for {{ app }}',
  ) =>
    ctx.client.json<{ id: string; version: number; checks: { id: string; level: string }[] }>(
      `${t}/draft`,
      {
        method: 'PUT',
        json: { subject, html, variables },
      },
    )
  const publish = () =>
    ctx.client.json<{ version: number; error?: unknown }>(`${t}/publish`, { method: 'POST' })
  const api = await apiCaller(ctx.client, ctx.projectId, ctx.sandboxId, [
    'emails:send',
    'emails:read',
    'templates:read',
  ])
  return { ...ctx, ...api, t, id: created.body.id, draft, publish }
}

const otpVars = [
  { name: 'app', required: true, example: 'Acme' },
  { name: 'code', required: true, sensitive: true, example: '123456' },
]

describe('templates', () => {
  it('saves drafts, blocks publishing with errors, then publishes immutably', async () => {
    const s = await setup()
    const bad = await s.draft('<p>{{ code }} {{ oops }}</p>')
    expect(bad.body.checks.map((c) => c.id)).toContain('undeclared:oops')
    expect((await s.publish()).status).toBe(422)

    await s.draft('<p>Code: <b>{{ code }}</b></p>')
    const v1 = await s.publish()
    expect(v1.body.version).toBe(1)
    expect((await s.publish()).body).toMatchObject({ error: { code: 'no_draft' } })

    // Editing after publish creates a new draft version; v1 stays as published.
    const d2 = await s.draft('<p>New code: {{ code }}</p>')
    expect(d2.body.version).toBe(2)
    const tpl = await s.client.json<{
      versions: { version: number; status: string; html: string }[]
    }>(s.t)
    expect(tpl.body.versions.map((v) => [v.version, v.status])).toEqual([
      [2, 'draft'],
      [1, 'published'],
    ])
    expect(tpl.body.versions[1]!.html).toBe('<p>Code: <b>{{ code }}</b></p>')
  })

  it('previews with sample data and masks sensitive variables', async () => {
    const s = await setup()
    await s.draft('<p>{{ app }}: {{ code }}</p>')
    const res = await s.client.json<{ subject: string; html: string; text: string }>(
      `${s.t}/preview`,
      {
        method: 'POST',
        json: { variables: { app: 'Acme', code: '987654' } },
      },
    )
    expect(res.body.subject).toBe('Your code for Acme')
    expect(res.body.html).toBe('<p>Acme: ••••••</p>')
    expect(JSON.stringify(res.body)).not.toContain('987654')
  })

  it('sends by alias with variables and pins the rendered version (scenario 6)', async () => {
    const s = await setup()
    await s.draft('<p>v1 {{ code }}</p>')
    await s.publish()
    const scheduledAt = new Date(Date.now() + 86_400_000).toISOString()
    const sent = await s.call<{ id: string }>('POST', '/v1/emails', {
      from: 'a@acme.dev',
      to: 'u@example.com',
      template: { id: 'otp', variables: { app: 'Acme', code: '111222' } },
      scheduledAt,
    })
    expect(sent.status).toBe(202)

    await s.draft('<p>v2 {{ code }}</p>')
    await s.publish()

    const email = await env.DB_EVENTS.prepare(
      'SELECT payload_key, template_version_id, subject FROM email WHERE id = ?',
    )
      .bind(sent.body.id)
      .first<{ payload_key: string; template_version_id: string; subject: string }>()
    expect(email!.subject).toBe('Your code for Acme')
    const payload = await (await env.BLOBS.get(email!.payload_key))!.json<{
      html: string
      text: string
    }>()
    expect(payload.html).toBe('<p>v1 111222</p>')
    expect(payload.text).toBe('v1 111222')
  })

  it('rejects unpublished templates and invalid variables', async () => {
    const s = await setup()
    const send = (variables: Record<string, unknown>) =>
      s.call<{ error: { code: string; details?: { issues: { path: string }[] } } }>(
        'POST',
        '/v1/emails',
        {
          from: 'a@acme.dev',
          to: 'u@example.com',
          template: { id: 'otp', variables },
        },
      )
    expect((await send({ app: 'A', code: '1' })).body.error.code).toBe('template_not_published')
    await s.draft('<p>{{ code }}</p>')
    await s.publish()
    const bad = await send({ app: 'A' })
    expect(bad.body.error.code).toBe('template_variables_invalid')
    expect(bad.body.error.details!.issues.map((i) => i.path)).toEqual(['code'])
  })

  it('rolls back to an earlier published version', async () => {
    const s = await setup()
    await s.draft('<p>one {{ code }}</p>')
    await s.publish()
    const tpl1 = await s.client.json<{ versions: { id: string }[] }>(s.t)
    const v1 = tpl1.body.versions[0]!.id
    await s.draft('<p>two {{ code }}</p>')
    await s.publish()
    await s.client.json(`${s.t}/rollback`, { method: 'POST', json: { versionId: v1 } })
    const list = await s.call<{ data: { alias: string; version: number }[] }>(
      'GET',
      '/v1/templates',
    )
    expect(list.body.data).toEqual([expect.objectContaining({ alias: 'otp', version: 1 })])
  })

  it('test-sends the draft through the sandbox', async () => {
    const s = await setup()
    await s.draft('<p>{{ code }}</p>')
    const res = await s.client.json<{ id: string; status: string }>(`${s.t}/test`, {
      method: 'POST',
      json: { to: 'me@example.com', from: 'test@acme.dev', environmentId: s.sandboxId },
    })
    expect(res.status).toBe(202)
    const email = await env.DB_EVENTS.prepare('SELECT subject, tags FROM email WHERE id = ?')
      .bind(res.body.id)
      .first<{ subject: string; tags: string }>()
    expect(email!.subject).toBe('[Test] Your code for Acme')
    expect(JSON.parse(email!.tags)).toMatchObject({ dak_test: 'true', template: 'otp' })
  })
})
