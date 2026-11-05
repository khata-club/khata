import { env, exports } from 'cloudflare:workers'

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

/** Invites a new user into `owner`'s organization with `role` and returns their client. */
export async function joinAs(owner: TestClient, organizationId: string, role: string) {
  const email = `member-${crypto.randomUUID().slice(0, 8)}@example.com`
  const inv = await owner.json<{ id: string }>('/auth/organization/invite-member', {
    method: 'POST',
    json: { email, role, organizationId },
  })
  if (inv.status !== 200) throw new Error(`invite failed: ${JSON.stringify(inv.body)}`)
  const client = new TestClient()
  await client.json('/auth/sign-up/email', {
    method: 'POST',
    json: { email, password: 'correct horse battery', name: 'Member' },
  })
  // Invitations require a verified email; stand in for clicking the verification link.
  await env.DB.prepare('UPDATE user SET email_verified = 1 WHERE email = ?').bind(email).run()
  const accepted = await client.json('/auth/organization/accept-invitation', {
    method: 'POST',
    json: { invitationId: inv.body.id },
  })
  if (accepted.status !== 200) throw new Error(`accept failed: ${JSON.stringify(accepted.body)}`)
  await client.json('/auth/organization/set-active', { method: 'POST', json: { organizationId } })
  return client
}

/** Owner + first workspace + a project with its default environments. */
export async function withProject(name = 'Owner') {
  const ctx = await signUpWithOrg(name)
  const ws = await ctx.client.json<{ data: { id: string }[] }>('/api/workspaces')
  const workspaceId = ws.body.data[0]!.id
  const created = await ctx.client.json<{ id: string }>('/api/projects', {
    method: 'POST',
    json: { name: 'Shop', workspaceId },
  })
  if (created.status !== 201) throw new Error(`project failed: ${JSON.stringify(created.body)}`)
  const list = await ctx.client.json<{
    data: { id: string; environments: { id: string; kind: string; sendingEnabled: boolean }[] }[]
  }>('/api/projects')
  const project = list.body.data.find((p) => p.id === created.body.id)!
  const env = (kind: string) => project.environments.find((e) => e.kind === kind)!
  return {
    ...ctx,
    workspaceId,
    projectId: project.id,
    sandboxId: env('sandbox').id,
    productionId: env('production').id,
  }
}

/** Creates an API key for an environment and returns a /v1 caller bound to it. */
export async function apiCaller(
  owner: TestClient,
  projectId: string,
  environmentId: string,
  scopes = ['emails:send', 'emails:read', 'emails:cancel'],
) {
  const created = await owner.json<{ id: string; key: string }>(
    `/api/projects/${projectId}/api-keys`,
    {
      method: 'POST',
      json: { name: 'test', environmentId, scopes },
    },
  )
  if (created.status !== 201) throw new Error(`key failed: ${JSON.stringify(created.body)}`)
  const call = async <T = Record<string, unknown>>(
    method: string,
    path: string,
    body?: unknown,
    headers: Record<string, string> = {},
  ) => {
    const res = await exports.default.fetch(`https://api.test${path}`, {
      method,
      headers: {
        authorization: `Bearer ${created.body.key}`,
        ...(body !== undefined && { 'content-type': 'application/json' }),
        ...headers,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
    return {
      status: res.status,
      headers: res.headers,
      body: (await res.json().catch(() => null)) as T,
    }
  }
  return { key: created.body.key, keyId: created.body.id, call }
}

export const sampleEmail = (over: Record<string, unknown> = {}) => ({
  from: 'Acme <hello@acme.dev>',
  to: 'ada@example.com',
  subject: 'Your code',
  html: '<p>123456</p>',
  ...over,
})
