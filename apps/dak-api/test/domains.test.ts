import { env } from 'cloudflare:workers'
import { afterEach, describe, expect, it } from 'vitest'

import { runDomainHealth } from '../src/jobs/domain-health'
import { mockAws, type AwsMockState } from './aws-mock'
import { signUpWithOrg, withProject } from './helpers'

let restore: (() => void) | undefined
afterEach(() => restore?.())

function useAws(init: Partial<AwsMockState> = {}) {
  const m = mockAws(init)
  restore = m.restore
  return m.state
}

interface DomainRow {
  id: string
  name: string
  status: string
  records: { purpose: string; name: string; value: string; action: string }[]
  senders: { email: string }[]
}

describe('domains', () => {
  it('creates an SES identity with Easy DKIM, custom MAIL FROM and records', async () => {
    const aws = useAws()
    const ctx = await withProject()
    const res = await ctx.client.json<{ id: string }>(`/api/projects/${ctx.projectId}/domains`, {
      method: 'POST',
      json: { name: 'Acme.Dev' },
    })
    expect(res.status).toBe(201)

    expect(aws.identities.get('acme.dev')?.mailFrom).toBe('send.acme.dev')
    const create = aws.calls.find((c) => c.url.endsWith('/v2/email/identities'))!
    expect(create.authorization).toContain('Credential=AKIATESTBROKER/')

    const list = await ctx.client.json<{ data: DomainRow[] }>(
      `/api/projects/${ctx.projectId}/domains`,
    )
    const d = list.body.data[0]!
    expect(d).toMatchObject({ name: 'acme.dev', status: 'pending' })
    expect(d.records.map((r) => r.purpose)).toEqual([
      'dkim',
      'dkim',
      'dkim',
      'mail_from_mx',
      'mail_from_spf',
      'dmarc',
    ])
  })

  it('proposes merging into an existing SPF record', async () => {
    useAws({ dns: { 'TXT send.shop.dev': ['v=spf1 include:sendgrid.net -all'] } })
    const ctx = await withProject()
    await ctx.client.json(`/api/projects/${ctx.projectId}/domains`, {
      method: 'POST',
      json: { name: 'shop.dev' },
    })
    const list = await ctx.client.json<{ data: DomainRow[] }>(
      `/api/projects/${ctx.projectId}/domains`,
    )
    const spf = list.body.data[0]!.records.filter((r) => r.purpose === 'mail_from_spf')
    expect(spf).toEqual([
      expect.objectContaining({
        action: 'merge',
        value: 'v=spf1 include:sendgrid.net include:amazonses.com -all',
      }),
    ])
  })

  it('verifies once SES and DNS agree', async () => {
    const aws = useAws()
    const ctx = await withProject()
    const { body } = await ctx.client.json<{ id: string }>(
      `/api/projects/${ctx.projectId}/domains`,
      {
        method: 'POST',
        json: { name: 'ok.dev' },
      },
    )
    const verifyUrl = `/api/projects/${ctx.projectId}/domains/${body.id}/verify`
    expect(
      (await ctx.client.json<{ status: string }>(verifyUrl, { method: 'POST' })).body.status,
    ).toBe('pending')

    Object.assign(aws.identities.get('ok.dev')!, { verified: true, dkim: 'SUCCESS' })
    aws.dns['TXT send.ok.dev'] = ['v=spf1 include:amazonses.com ~all']
    aws.dns['TXT _dmarc.ok.dev'] = ['v=DMARC1; p=none;']
    const done = await ctx.client.json<{ status: string; spfStatus: string; dmarcStatus: string }>(
      verifyUrl,
      {
        method: 'POST',
      },
    )
    expect(done.body).toMatchObject({
      status: 'verified',
      spfStatus: 'pass',
      dmarcStatus: 'present',
    })
  })

  it('stops a second organization claiming a platform domain', async () => {
    useAws()
    const a = await withProject('Alice')
    await a.client.json(`/api/projects/${a.projectId}/domains`, {
      method: 'POST',
      json: { name: 'claimed.dev' },
    })
    const b = await withProject('Bob')
    const res = await b.client.json(`/api/projects/${b.projectId}/domains`, {
      method: 'POST',
      json: { name: 'claimed.dev' },
    })
    expect(res).toMatchObject({ status: 409, body: { error: { code: 'domain_taken' } } })
  })

  it('rejects invalid domains and senders outside the domain', async () => {
    useAws()
    const ctx = await withProject()
    const bad = await ctx.client.json(`/api/projects/${ctx.projectId}/domains`, {
      method: 'POST',
      json: { name: 'not a domain' },
    })
    expect(bad.body).toMatchObject({ error: { code: 'invalid_domain' } })

    const { body } = await ctx.client.json<{ id: string }>(
      `/api/projects/${ctx.projectId}/domains`,
      {
        method: 'POST',
        json: { name: 'mail.dev' },
      },
    )
    const senders = `/api/projects/${ctx.projectId}/domains/${body.id}/senders`
    expect(
      (await ctx.client.json(senders, { method: 'POST', json: { email: 'hi@other.dev' } })).status,
    ).toBe(422)
    expect(
      (await ctx.client.json(senders, { method: 'POST', json: { email: 'Hi@News.Mail.dev' } }))
        .status,
    ).toBe(201)
    const list = await ctx.client.json<{ data: DomainRow[] }>(
      `/api/projects/${ctx.projectId}/domains`,
    )
    expect(list.body.data[0]!.senders.map((s) => s.email)).toEqual(['hi@news.mail.dev'])
  })

  it('needs domain:manage to add domains', async () => {
    useAws()
    const ctx = await signUpWithOrg()
    const res = await ctx.client.json('/api/projects/prj_missing/domains', {
      method: 'POST',
      json: { name: 'x.dev' },
    })
    expect(res.status).toBe(404)
  })

  it('deletes the SES identity with the domain', async () => {
    const aws = useAws()
    const ctx = await withProject()
    const { body } = await ctx.client.json<{ id: string }>(
      `/api/projects/${ctx.projectId}/domains`,
      {
        method: 'POST',
        json: { name: 'gone.dev' },
      },
    )
    const del = await ctx.client.fetch(`/api/projects/${ctx.projectId}/domains/${body.id}`, {
      method: 'DELETE',
    })
    expect(del.status).toBe(204)
    expect(aws.identities.has('gone.dev')).toBe(false)
  })

  it('re-checks due domains from the cron', async () => {
    const aws = useAws()
    const ctx = await withProject()
    await ctx.client.json(`/api/projects/${ctx.projectId}/domains`, {
      method: 'POST',
      json: { name: 'cron.dev' },
    })
    Object.assign(aws.identities.get('cron.dev')!, { verified: true, dkim: 'SUCCESS' })
    const result = await runDomainHealth(env, Date.now() + 11 * 60_000)
    expect(result.checked).toBeGreaterThanOrEqual(1)
    const list = await ctx.client.json<{ data: DomainRow[] }>(
      `/api/projects/${ctx.projectId}/domains`,
    )
    expect(list.body.data[0]!.status).toBe('verified')
  })
})
