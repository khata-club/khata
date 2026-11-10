import { testUtils } from 'better-auth/plugins'
import { env } from 'cloudflare:test'

import { app } from '../worker'
import { createAuth } from '../worker/auth'

/** Create a user (seeded through the real Better Auth hook) and return a signed-in client. */
export async function signIn(email = `u${crypto.randomUUID().slice(0, 8)}@example.com`) {
  const ctx = await createAuth(env, [testUtils()]).$context
  const user = await ctx.test.saveUser(ctx.test.createUser({ email, name: 'Test User' }))
  const headers = await ctx.test.getAuthHeaders({ userId: user.id })
  const cookie = headers.get('cookie')!

  async function call<T = unknown>(method: string, path: string, body?: unknown) {
    const res = await app.request(
      `/api${path}`,
      {
        method,
        headers: { cookie, ...(body === undefined ? {} : { 'content-type': 'application/json' }) },
        body: body === undefined ? undefined : JSON.stringify(body),
      },
      env,
    )
    const text = await res.text()
    let json: T | undefined
    try {
      json = text ? (JSON.parse(text) as T) : undefined
    } catch {
      json = undefined
    }
    return { status: res.status, json: json as T, text, headers: res.headers }
  }

  return {
    user,
    get: <T = unknown>(p: string) => call<T>('GET', p),
    post: <T = unknown>(p: string, b?: unknown) => call<T>('POST', p, b ?? {}),
    put: <T = unknown>(p: string, b: unknown) => call<T>('PUT', p, b),
    patch: <T = unknown>(p: string, b: unknown) => call<T>('PATCH', p, b),
    del: <T = unknown>(p: string) => call<T>('DELETE', p),
  }
}
export type Client = Awaited<ReturnType<typeof signIn>>
