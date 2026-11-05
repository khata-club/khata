import { describe, expect, it } from 'vitest'

import { can } from '../src/auth/permissions'
import { signUpWithOrg, TestClient } from './helpers'

describe('roles (spec §4)', () => {
  it('lets owners do everything and billing only billing', () => {
    expect(can('owner', { billing: ['manage'], emailBody: ['read'] })).toBe(true)
    expect(can('billing', { billing: ['manage'] })).toBe(true)
    expect(can('billing', { email: ['read'] })).toBe(false)
  })

  it('keeps email bodies a distinct permission', () => {
    expect(can('developer', { email: ['read'] })).toBe(true)
    expect(can('developer', { emailBody: ['read'] })).toBe(false)
    expect(can('admin', { emailBody: ['read'] })).toBe(false)
  })

  it('scopes developers, marketers and analysts', () => {
    expect(can('developer', { apiKey: ['manage'], webhook: ['manage'] })).toBe(true)
    expect(can('developer', { domain: ['manage'] })).toBe(false)
    expect(can('marketer', { campaign: ['write'], contact: ['write'] })).toBe(true)
    expect(can('marketer', { campaign: ['approve'] })).toBe(false)
    expect(can('analyst', { analytics: ['read'], template: ['read'] })).toBe(true)
    expect(can('analyst', { template: ['write'] })).toBe(false)
  })

  it('combines multiple roles', () => {
    expect(can('analyst,billing', { billing: ['read'], analytics: ['read'] })).toBe(true)
    expect(can('unknown', { analytics: ['read'] })).toBe(false)
  })
})

describe('auth flow', () => {
  it('rejects the dashboard API without a session', async () => {
    const res = await new TestClient().json('/api/me')
    expect(res).toMatchObject({ status: 401, body: { error: { code: 'unauthenticated' } } })
  })

  it('signs up, creates an org and reports owner permissions', async () => {
    const { client, organizationId, email } = await signUpWithOrg()
    expect(organizationId).toMatch(/^org_[0-9A-Z]{26}$/)

    const me = await client.json<{
      user: { email: string; id: string }
      role: string
      organizationId: string
      permissions: Record<string, string[]>
    }>('/api/me')
    expect(me.status).toBe(200)
    expect(me.body.user.email).toBe(email)
    expect(me.body.user.id).toMatch(/^usr_/)
    expect(me.body.role).toBe('owner')
    expect(me.body.organizationId).toBe(organizationId)
    expect(me.body.permissions.emailBody).toEqual(['read'])
  })

  it('creates a default workspace team with prefixed IDs', async () => {
    const { client } = await signUpWithOrg('Grace')
    const teams = await client.json<{ id: string; name: string }[]>('/auth/organization/list-teams')
    expect(teams.status).toBe(200)
    expect(teams.body[0]?.id).toMatch(/^ws_/)
  })
})
