import { exports } from 'cloudflare:workers'
import { describe, expect, it } from 'vitest'

import { joinAs, withProject } from './helpers'

async function v1(key: string | undefined, path = '/v1/me') {
  const res = await exports.default.fetch(`https://api.test${path}`, {
    headers: key ? { authorization: `Bearer ${key}` } : {},
  })
  return { status: res.status, body: (await res.json()) as Record<string, unknown> }
}

describe('API keys', () => {
  it('issues a test key for sandbox, shown once and stored hashed', async () => {
    const ctx = await withProject()
    const created = await ctx.client.json<{ id: string; key: string; prefix: string }>(
      `/api/projects/${ctx.projectId}/api-keys`,
      { method: 'POST', json: { name: 'CI', environmentId: ctx.sandboxId } },
    )
    expect(created.status).toBe(201)
    expect(created.body.key).toMatch(/^dak_test_[A-Za-z0-9_-]{32}$/)
    expect(created.body.key.startsWith(created.body.prefix)).toBe(true)

    const list = await ctx.client.json<{ data: Record<string, unknown>[] }>(
      `/api/projects/${ctx.projectId}/api-keys`,
    )
    expect(list.body.data[0]).toMatchObject({ scopes: ['emails:send'], status: 'active' })
    expect(list.body.data[0]).not.toHaveProperty('hash')
    expect(JSON.stringify(list.body)).not.toContain(created.body.key)

    const me = await v1(created.body.key)
    expect(me).toMatchObject({
      status: 200,
      body: { keyId: created.body.id, projectId: ctx.projectId, environment: { kind: 'sandbox' } },
    })
  })

  it('issues live keys for production', async () => {
    const ctx = await withProject()
    const created = await ctx.client.json<{ key: string }>(
      `/api/projects/${ctx.projectId}/api-keys`,
      {
        method: 'POST',
        json: {
          name: 'Prod',
          environmentId: ctx.productionId,
          scopes: ['emails:send', 'emails:read'],
        },
      },
    )
    expect(created.body.key).toMatch(/^dak_live_/)
  })

  it('rejects missing, malformed, unknown and revoked keys', async () => {
    const ctx = await withProject()
    expect((await v1(undefined)).body).toMatchObject({ error: { code: 'missing_api_key' } })
    expect((await v1('sk_live_nope')).status).toBe(401)
    expect((await v1('dak_live_' + 'x'.repeat(32))).body).toMatchObject({
      error: { code: 'invalid_api_key' },
    })

    const created = await ctx.client.json<{ id: string; key: string }>(
      `/api/projects/${ctx.projectId}/api-keys`,
      {
        method: 'POST',
        json: { name: 'Tmp', environmentId: ctx.sandboxId },
      },
    )
    await ctx.client.fetch(`/api/projects/${ctx.projectId}/api-keys/${created.body.id}`, {
      method: 'DELETE',
    })
    expect((await v1(created.body.key)).status).toBe(401)
  })

  it('rolls a key: the old secret stops working, the new one works', async () => {
    const ctx = await withProject()
    const old = await ctx.client.json<{ id: string; key: string }>(
      `/api/projects/${ctx.projectId}/api-keys`,
      {
        method: 'POST',
        json: {
          name: 'Roll me',
          environmentId: ctx.sandboxId,
          scopes: ['emails:send', 'emails:read'],
        },
      },
    )
    const rolled = await ctx.client.json<{ key: string }>(
      `/api/projects/${ctx.projectId}/api-keys/${old.body.id}/roll`,
      { method: 'POST' },
    )
    expect((await v1(old.body.key)).status).toBe(401)
    expect((await v1(rolled.body.key)).body).toMatchObject({
      scopes: ['emails:send', 'emails:read'],
    })
  })

  it('validates environment, scopes and domain restrictions', async () => {
    const ctx = await withProject()
    const url = `/api/projects/${ctx.projectId}/api-keys`
    expect(
      (
        await ctx.client.json(url, {
          method: 'POST',
          json: { name: 'x', environmentId: 'env_nope' },
        })
      ).status,
    ).toBe(422)
    expect(
      (
        await ctx.client.json(url, {
          method: 'POST',
          json: { name: 'x', environmentId: ctx.sandboxId, scopes: ['admin'] },
        })
      ).status,
    ).toBe(422)
    const dom = await ctx.client.json(url, {
      method: 'POST',
      json: { name: 'x', environmentId: ctx.sandboxId, allowedDomains: ['nope.dev'] },
    })
    expect(dom.body).toMatchObject({ error: { code: 'unknown_domain' } })
  })

  it('needs apiKey:manage (analysts cannot create keys)', async () => {
    const ctx = await withProject()
    const analyst = await joinAs(ctx.client, ctx.organizationId, 'analyst')
    const res = await analyst.json(`/api/projects/${ctx.projectId}/api-keys`, {
      method: 'POST',
      json: { name: 'x', environmentId: ctx.sandboxId },
    })
    expect(res.status).toBe(403)
  })
})
