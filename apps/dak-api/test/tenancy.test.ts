import { describe, expect, it } from 'vitest'

import { joinAs, signUpWithOrg, withProject } from './helpers'

describe('workspaces and projects', () => {
  it('creates a project with sandbox and disabled production environments', async () => {
    const { client, projectId } = await withProject()
    const { body } = await client.json<{
      data: {
        id: string
        slug: string
        environments: { kind: string; sendingEnabled: boolean }[]
      }[]
    }>('/api/projects')
    const p = body.data.find((x) => x.id === projectId)!
    expect(p.slug).toBe('shop')
    expect(p.environments.map((e) => [e.kind, e.sendingEnabled]).sort()).toEqual([
      ['production', false],
      ['sandbox', true],
    ])
  })

  it('creates workspaces as teams with settings', async () => {
    const { client } = await signUpWithOrg()
    const created = await client.json<{ id: string }>('/api/workspaces', {
      method: 'POST',
      json: { name: 'Agency clients', defaultRegion: 'us-east-1' },
    })
    expect(created.status).toBe(201)
    const list = await client.json<{ data: { id: string; defaultRegion: string | null }[] }>(
      '/api/workspaces',
    )
    expect(list.body.data.find((w) => w.id === created.body.id)?.defaultRegion).toBe('us-east-1')
  })

  it('validates input with field-level issues', async () => {
    const { client } = await signUpWithOrg()
    const res = await client.json<{
      error: { code: string; details: { issues: { path: string }[] } }
    }>('/api/projects', { method: 'POST', json: { name: '', workspaceId: 'ws_x', region: 'mars' } })
    expect(res.status).toBe(422)
    expect(res.body.error.details.issues.map((i) => i.path).sort()).toEqual(['name', 'region'])
  })

  it('never shows one tenant another tenant’s project', async () => {
    const a = await withProject('Alice')
    const b = await signUpWithOrg('Bob')
    const list = await b.client.json<{ data: unknown[] }>('/api/projects')
    expect(list.body.data).toEqual([])
    const patch = await b.client.json(`/api/projects/${a.projectId}`, {
      method: 'PATCH',
      json: { name: 'mine now' },
    })
    expect(patch.status).toBe(404)
  })

  it('pauses an environment and archives a project', async () => {
    const { client, projectId, productionId } = await withProject()
    const paused = await client.json(`/api/projects/${projectId}/environments/${productionId}`, {
      method: 'PATCH',
      json: { paused: true, pauseReason: 'incident' },
    })
    expect(paused.status).toBe(200)
    expect((await client.fetch(`/api/projects/${projectId}`, { method: 'DELETE' })).status).toBe(
      204,
    )
    const list = await client.json<{ data: unknown[] }>('/api/projects')
    expect(list.body.data).toEqual([])
  })
})

describe('permissions', () => {
  it('lets analysts read but not create projects or read audit', async () => {
    const owner = await withProject()
    const analyst = await joinAs(owner.client, owner.organizationId, 'analyst')
    expect((await analyst.json('/api/projects')).status).toBe(200)
    const create = await analyst.json('/api/projects', {
      method: 'POST',
      json: { name: 'Nope', workspaceId: owner.workspaceId },
    })
    expect(create).toMatchObject({ status: 403, body: { error: { code: 'forbidden' } } })
    expect((await analyst.json('/api/audit')).status).toBe(403)
  })

  it('denies billing members everything but billing', async () => {
    const owner = await withProject()
    const billing = await joinAs(owner.client, owner.organizationId, 'billing')
    expect((await billing.json('/api/projects')).status).toBe(403)
    const me = await billing.json<{ permissions: Record<string, string[]> }>('/api/me')
    expect(me.body.permissions.billing).toEqual(['read', 'manage'])
    expect(me.body.permissions.project).toEqual([])
  })
})

describe('audit and support access', () => {
  it('records administrative actions newest first', async () => {
    const { client, projectId } = await withProject()
    await client.json(`/api/projects/${projectId}`, {
      method: 'PATCH',
      json: { retainBodies: false },
    })
    const log = await client.json<{ data: { action: string; targetId: string; actor: string }[] }>(
      '/api/audit',
    )
    expect(log.body.data.map((e) => e.action).slice(0, 2)).toEqual([
      'project.updated',
      'project.created',
    ])
    expect(log.body.data[0]!.actor).toMatch(/^usr_/)
  })

  it('grants time-limited support access and revokes it', async () => {
    const { client } = await withProject()
    const grant = await client.json<{ id: string; expiresAt: number }>('/api/support-grants', {
      method: 'POST',
      json: { supportUserId: 'usr_support', reason: 'Investigate bounce spike', hours: 4 },
    })
    expect(grant.status).toBe(201)
    expect(grant.body.expiresAt - Date.now()).toBeLessThanOrEqual(4 * 3_600_000)
    expect(
      (await client.fetch(`/api/support-grants/${grant.body.id}`, { method: 'DELETE' })).status,
    ).toBe(204)
    const list = await client.json<{ data: { id: string; active: boolean }[] }>(
      '/api/support-grants',
    )
    expect(list.body.data[0]).toMatchObject({ id: grant.body.id, active: false })
  })

  it('rejects grants longer than 72 hours', async () => {
    const { client } = await withProject()
    const res = await client.json('/api/support-grants', {
      method: 'POST',
      json: { supportUserId: 'usr_s', reason: 'Too long please', hours: 200 },
    })
    expect(res.status).toBe(422)
  })
})
