import { afterEach, describe, expect, it, vi } from 'vitest'

import { api, ApiError } from './api'

afterEach(() => vi.unstubAllGlobals())

function stubFetch(status: number, body: unknown) {
  const fetch = vi.fn(async () => new Response(JSON.stringify(body), { status }))
  vi.stubGlobal('fetch', fetch)
  return fetch
}

describe('api', () => {
  it('returns parsed JSON on success', async () => {
    const fetch = stubFetch(200, { ok: true })
    await expect(api('/health')).resolves.toEqual({ ok: true })
    expect(fetch).toHaveBeenCalledWith(
      '/health',
      expect.objectContaining({ credentials: 'same-origin' }),
    )
  })

  it('throws ApiError with the API error code', async () => {
    stubFetch(403, { error: { code: 'forbidden' } })
    await expect(api('/api/x')).rejects.toEqual(new ApiError(403, 'forbidden'))
  })
})
