import { exports } from 'cloudflare:workers'

const ORIGIN = 'http://localhost:5174'

/** Minimal cookie-jar client against the Worker under test. */
export class TestClient {
  cookies = new Map<string, string>()

  async fetch(path: string, init: RequestInit & { json?: unknown } = {}): Promise<Response> {
    const headers = new Headers(init.headers)
    headers.set('origin', ORIGIN)
    if (this.cookies.size) {
      headers.set('cookie', [...this.cookies].map(([k, v]) => `${k}=${v}`).join('; '))
    }
    let body = init.body
    if (init.json !== undefined) {
      headers.set('content-type', 'application/json')
      body = JSON.stringify(init.json)
    }
    const res = await exports.default.fetch(`${ORIGIN}${path}`, { ...init, headers, body })
    for (const c of res.headers.getSetCookie()) {
      const [pair] = c.split(';')
      const [k, ...v] = pair!.split('=')
      const value = v.join('=')
      if (value) this.cookies.set(k!, value)
      else this.cookies.delete(k!)
    }
    return res
  }

  async json<T = unknown>(path: string, init: RequestInit & { json?: unknown } = {}) {
    const res = await this.fetch(path, init)
    return { status: res.status, body: (await res.json().catch(() => null)) as T }
  }
}

let n = 0

/** Signs up a fresh user, creates an organization and makes it active. */
export async function signUpWithOrg(name = 'Ada') {
  const client = new TestClient()
  const id = ++n
  const email = `${name.toLowerCase()}${id}-${crypto.randomUUID().slice(0, 6)}@example.com`
  const signUp = await client.json<{ user: { id: string } }>('/auth/sign-up/email', {
    method: 'POST',
    json: { email, password: 'correct horse battery', name },
  })
  if (signUp.status !== 200) throw new Error(`sign-up failed: ${JSON.stringify(signUp.body)}`)
  const org = await client.json<{ id: string }>('/auth/organization/create', {
    method: 'POST',
    json: { name: `${name} Inc ${id}`, slug: `org-${id}-${crypto.randomUUID().slice(0, 8)}` },
  })
  if (org.status !== 200) throw new Error(`org create failed: ${JSON.stringify(org.body)}`)
  return { client, email, userId: signUp.body.user.id, organizationId: org.body.id }
}
