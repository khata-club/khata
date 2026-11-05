import { describe, expect, it, vi } from 'vitest'

import { Dak } from './client.ts'
import { DakError } from './errors.ts'

function mockFetch(status: number, body: unknown, headers: Record<string, string> = {}) {
  return vi.fn<typeof fetch>(
    async () =>
      new Response(body === undefined ? null : JSON.stringify(body), {
        status,
        headers: { 'content-type': 'application/json', ...headers },
      }),
  )
}

describe('Dak', () => {
  it('rejects keys without the dak_ prefix', () => {
    expect(() => new Dak({ apiKey: 'sk_123' })).toThrow(DakError)
  })

  it('sends auth, JSON and idempotency headers', async () => {
    const fetch = mockFetch(202, { id: 'em_1' })
    const dak = new Dak({ apiKey: 'dak_test_abc', baseUrl: 'http://api.test/', fetch })

    const res = await dak.request('POST', '/v1/emails', { to: 'a@b.c' }, { idempotencyKey: 'k1' })

    expect(res).toEqual({ id: 'em_1' })
    const [url, init] = fetch.mock.calls[0]!
    expect(url).toBe('http://api.test/v1/emails')
    expect(init?.headers).toMatchObject({
      authorization: 'Bearer dak_test_abc',
      'content-type': 'application/json',
      'idempotency-key': 'k1',
    })
    expect(init?.body).toBe('{"to":"a@b.c"}')
  })

  it('maps API errors to DakError with code and request ID', async () => {
    const fetch = mockFetch(
      409,
      { error: { code: 'idempotency_conflict', message: 'Payload changed' } },
      { 'x-request-id': 'req_9' },
    )
    const dak = new Dak({ apiKey: 'dak_live_x', fetch })

    await expect(dak.request('POST', '/v1/emails', {})).rejects.toMatchObject({
      status: 409,
      code: 'idempotency_conflict',
      message: 'Payload changed',
      requestId: 'req_9',
    })
  })

  it('reports transport failures as status 0', async () => {
    const fetch = vi.fn<typeof globalThis.fetch>(async () => {
      throw new TypeError('connection refused')
    })
    const dak = new Dak({ apiKey: 'dak_live_x', fetch })

    await expect(dak.request('GET', '/v1/emails')).rejects.toMatchObject({
      status: 0,
      code: 'network_error',
    })
  })
})
