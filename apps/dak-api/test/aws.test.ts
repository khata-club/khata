import { env } from 'cloudflare:workers'
import { afterEach, describe, expect, it } from 'vitest'

import { clearCredentialCache } from '../src/aws/credentials'
import { open, seal } from '../src/lib/crypto'
import { mockAws } from './aws-mock'
import { signUpWithOrg, withProject } from './helpers'

let restore: (() => void) | undefined
afterEach(() => {
  restore?.()
  clearCredentialCache()
})

interface Created {
  id: string
  externalId: string
  launchUrl: string
  configurationSetPrefix: string
  status: string
}

async function createConnection(client: Awaited<ReturnType<typeof signUpWithOrg>>['client']) {
  const res = await client.json<Created>('/api/aws-connections', {
    method: 'POST',
    json: { region: 'eu-west-1' },
  })
  expect(res.status).toBe(201)
  return res.body
}

const roleFor = (id: string) => `arn:aws:iam::210987654321:role/DakSending-${id.slice(4)}`

describe('envelope encryption', () => {
  it('round-trips and uses a fresh IV each time', async () => {
    const a = await seal(env.DAK_DATA_KEY, 'external-id')
    const b = await seal(env.DAK_DATA_KEY, 'external-id')
    expect(a).not.toBe(b)
    expect(await open(env.DAK_DATA_KEY, a)).toBe('external-id')
  })
})

describe('BYO AWS connections', () => {
  it('creates a pending connection with a one-time external ID and quick-create link', async () => {
    const { client } = await signUpWithOrg()
    const conn = await createConnection(client)
    expect(conn.status).toBe('pending')
    expect(conn.externalId.length).toBeGreaterThanOrEqual(32)
    const url = new URL(conn.launchUrl.replace('#/stacks/quickcreate?', '?'))
    expect(url.searchParams.get('param_ConnectionId')).toBe(conn.id)
    expect(url.searchParams.get('param_ExternalId')).toBe(conn.externalId)

    const list = await client.json<{ data: Record<string, unknown>[] }>('/api/aws-connections')
    expect(list.body.data[0]).not.toHaveProperty('externalIdEnc')
    expect(JSON.stringify(list.body)).not.toContain(conn.externalId)
  })

  it('verifies a role by assuming it with the external ID and checking health', async () => {
    const { client } = await signUpWithOrg()
    const conn = await createConnection(client)
    const aws = mockAws({
      configurationSets: new Set([`${conn.configurationSetPrefix}-transactional`]),
    })
    restore = aws.restore

    const res = await client.json<{
      status: string
      accountId: string
      health: { ok: boolean; checks: { id: string; ok: boolean }[] }
    }>(`/api/aws-connections/${conn.id}/verify`, {
      method: 'POST',
      json: { roleArn: roleFor(conn.id) },
    })
    expect(res.status).toBe(200)
    expect(res.body.status).toBe('healthy')
    expect(res.body.accountId).toBe('210987654321')
    expect(res.body.health.checks.map((c) => [c.id, c.ok])).toEqual([
      ['credentials', true],
      ['production', true],
      ['sending', true],
      ['quota', true],
      ['events', true],
    ])

    const sts = aws.state.calls.find((c) => c.url.includes('sts.'))!
    expect(new URLSearchParams(sts.body).get('ExternalId')).toBe(conn.externalId)
    expect(sts.authorization).toContain('Credential=AKIATESTBROKER/')
    const ses = aws.state.calls.find((c) => c.url.endsWith('/v2/email/account'))!
    expect(ses.authorization).toContain('Credential=ASIATEMP/')
  })

  it('reports a failed assume without marking the connection healthy', async () => {
    const { client } = await signUpWithOrg()
    const conn = await createConnection(client)
    restore = mockAws({ assumeFails: 'not authorized' }).restore
    const res = await client.json<{
      status: string
      health: { ok: boolean; checks: { detail: string }[] }
    }>(`/api/aws-connections/${conn.id}/verify`, {
      method: 'POST',
      json: { roleArn: roleFor(conn.id) },
    })
    expect(res.body.status).toBe('pending')
    expect(res.body.health.ok).toBe(false)
    expect(res.body.health.checks[0]!.detail).toContain('AccessDenied')
  })

  it('flags SES sandbox mode and missing event wiring', async () => {
    const { client } = await signUpWithOrg()
    const conn = await createConnection(client)
    restore = mockAws({
      account: {
        ProductionAccessEnabled: false,
        SendingEnabled: true,
        SendQuota: { Max24HourSend: 200, MaxSendRate: 1, SentLast24Hours: 0 },
      },
    }).restore
    const res = await client.json<{
      health: { ok: boolean; checks: { id: string; ok: boolean }[] }
    }>(`/api/aws-connections/${conn.id}/verify`, {
      method: 'POST',
      json: { roleArn: roleFor(conn.id) },
    })
    const byId = Object.fromEntries(res.body.health.checks.map((c) => [c.id, c.ok]))
    expect(byId).toMatchObject({ production: false, events: false })
    expect(res.body.health.ok).toBe(false)
  })

  it('rejects roles from another connection', async () => {
    const { client } = await signUpWithOrg()
    const conn = await createConnection(client)
    const res = await client.json(`/api/aws-connections/${conn.id}/verify`, {
      method: 'POST',
      json: { roleArn: 'arn:aws:iam::210987654321:role/DakSending-01ABCDEFGHJKMNPQRSTVWXYZ01' },
    })
    expect(res).toMatchObject({ status: 422, body: { error: { code: 'role_mismatch' } } })
  })

  it('attaches only healthy connections to BYO projects in the same region', async () => {
    const ctx = await withProject()
    const conn = await createConnection(ctx.client)
    const early = await ctx.client.json(`/api/aws-connections/${conn.id}/attach`, {
      method: 'POST',
      json: { projectId: ctx.projectId },
    })
    expect(early.body).toMatchObject({ error: { code: 'mode_mismatch' } })

    const byo = await ctx.client.json<{ id: string }>('/api/projects', {
      method: 'POST',
      json: {
        name: 'Own AWS',
        workspaceId: ctx.workspaceId,
        infrastructureMode: 'byo',
        region: 'eu-west-1',
      },
    })
    const unhealthy = await ctx.client.json(`/api/aws-connections/${conn.id}/attach`, {
      method: 'POST',
      json: { projectId: byo.body.id },
    })
    expect(unhealthy.body).toMatchObject({ error: { code: 'unhealthy' } })

    restore = mockAws({
      configurationSets: new Set([`${conn.configurationSetPrefix}-transactional`]),
    }).restore
    await ctx.client.json(`/api/aws-connections/${conn.id}/verify`, {
      method: 'POST',
      json: { roleArn: roleFor(conn.id) },
    })
    const ok = await ctx.client.json(`/api/aws-connections/${conn.id}/attach`, {
      method: 'POST',
      json: { projectId: byo.body.id },
    })
    expect(ok.status).toBe(200)

    const disc = await ctx.client.json<{ status: string; pausedProjects: string[] }>(
      `/api/aws-connections/${conn.id}/disconnect`,
      { method: 'POST' },
    )
    expect(disc.body).toEqual({
      id: conn.id,
      status: 'disconnected',
      pausedProjects: [byo.body.id],
    })
    const projects = await ctx.client.json<{
      data: { id: string; environments: { pauseReason: string | null }[] }[]
    }>('/api/projects')
    const p = projects.body.data.find((x) => x.id === byo.body.id)!
    expect(p.environments.every((e) => e.pauseReason === 'aws_disconnected')).toBe(true)
  })
})
