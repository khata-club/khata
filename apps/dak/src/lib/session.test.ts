import { afterEach, describe, expect, it, vi } from 'vitest'

import { hasPermission, loadMe, me, meError } from './session'

afterEach(() => {
  vi.unstubAllGlobals()
  me.value = undefined
})

describe('session', () => {
  it('caches /api/me and exposes permissions', async () => {
    const fetch = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            user: { id: 'usr_1', name: 'Ada', email: 'a@x.dev' },
            organizationId: 'org_1',
            workspaceId: null,
            role: 'developer',
            permissions: { apiKey: ['read', 'manage'] },
          }),
        ),
    )
    vi.stubGlobal('fetch', fetch)
    await loadMe()
    await loadMe()
    expect(fetch).toHaveBeenCalledTimes(1)
    expect(hasPermission('apiKey', 'manage')).toBe(true)
    expect(hasPermission('billing', 'manage')).toBe(false)
  })

  it('records the error code when signed out', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(JSON.stringify({ error: { code: 'unauthenticated' } }), { status: 401 }),
      ),
    )
    expect(await loadMe(true)).toBeNull()
    expect(meError.value).toBe('unauthenticated')
  })
})
