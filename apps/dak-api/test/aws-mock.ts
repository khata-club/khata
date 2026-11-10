import { vi } from 'vitest'

export interface AwsMockState {
  account: Record<string, unknown>
  /** Names of configuration sets that exist. */
  configurationSets: Set<string>
  assumeFails?: string
  /** SES identities keyed by name. */
  identities: Map<string, { verified: boolean; dkim: string; tokens: string[]; mailFrom?: string }>
  /** DoH answers keyed `TYPE name`, e.g. `TXT send.acme.dev`. */
  dns: Record<string, string[]>
  calls: { url: string; method: string; body?: string; authorization?: string }[]
  /** Optional extra handler; return a Response to short-circuit. */
  handle?: (
    url: URL,
    init: RequestInit,
    body: string,
  ) => Response | undefined | Promise<Response | undefined>
}

export const healthyAccount = {
  ProductionAccessEnabled: true,
  SendingEnabled: true,
  EnforcementStatus: 'HEALTHY',
  SendQuota: { Max24HourSend: 50000, MaxSendRate: 14, SentLast24Hours: 120 },
}

/** Intercepts global fetch for *.amazonaws.com; everything else passes through. */
export function mockAws(initial: Partial<AwsMockState> = {}) {
  const state: AwsMockState = {
    account: healthyAccount,
    configurationSets: new Set(),
    identities: new Map(),
    dns: {},
    calls: [],
    ...initial,
  }
  const real = globalThis.fetch
  const spy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init = {}) => {
    const req = new Request(input as RequestInfo, init)
    const url = new URL(req.url)
    if (url.hostname === 'cloudflare-dns.com') {
      const type = url.searchParams.get('type')!
      const name = url.searchParams.get('name')!
      const code = { TXT: 16, CNAME: 5, MX: 15 }[type]
      const answers = state.dns[`${type} ${name}`] ?? []
      return Response.json({
        Status: 0,
        Answer: answers.map((data) => ({ type: code, data: type === 'TXT' ? `"${data}"` : data })),
      })
    }
    if (!url.hostname.endsWith('amazonaws.com')) return real(input as RequestInfo, init)
    const body = req.method === 'GET' ? '' : await req.text()
    state.calls.push({
      url: req.url,
      method: req.method,
      body,
      authorization: req.headers.get('authorization') ?? undefined,
    })
    const custom = await state.handle?.(url, init, body)
    if (custom) return custom

    if (url.hostname.startsWith('sts.')) {
      if (state.assumeFails) {
        return new Response(
          `<ErrorResponse><Error><Code>AccessDenied</Code><Message>${state.assumeFails}</Message></Error></ErrorResponse>`,
          { status: 403 },
        )
      }
      const exp = new Date(Date.now() + 3600_000).toISOString()
      return new Response(
        `<AssumeRoleResponse><AssumeRoleResult><Credentials><AccessKeyId>ASIATEMP</AccessKeyId><SecretAccessKey>tmp-secret</SecretAccessKey><SessionToken>tmp-token</SessionToken><Expiration>${exp}</Expiration></Credentials><AssumedRoleUser><Arn>arn:aws:sts::210987654321:assumed-role/DakSending-X/dak</Arn></AssumedRoleUser></AssumeRoleResult></AssumeRoleResponse>`,
      )
    }
    const path = url.pathname.replace(/^\/v2\/email/, '')
    if (path === '/account') return Response.json(state.account)
    if (path === '/identities' && req.method === 'POST') {
      const name = (JSON.parse(body) as { EmailIdentity: string }).EmailIdentity
      if (state.identities.has(name)) {
        return Response.json(
          { message: 'exists' },
          { status: 400, headers: { 'x-amzn-errortype': 'AlreadyExistsException' } },
        )
      }
      const tokens = ['tok1', 'tok2', 'tok3'].map((t) => `${t}${name.replace(/\W/g, '')}`)
      state.identities.set(name, { verified: false, dkim: 'PENDING', tokens })
      return Response.json({
        IdentityType: 'DOMAIN',
        VerifiedForSendingStatus: false,
        DkimAttributes: { Status: 'PENDING', Tokens: tokens },
      })
    }
    const ident = /^\/identities\/([^/]+)(\/mail-from)?$/.exec(path)
    if (ident) {
      const name = decodeURIComponent(ident[1]!)
      const id = state.identities.get(name)
      if (!id)
        return Response.json(
          { message: 'nope' },
          { status: 404, headers: { 'x-amzn-errortype': 'NotFoundException' } },
        )
      if (ident[2]) {
        id.mailFrom = (JSON.parse(body) as { MailFromDomain: string }).MailFromDomain
        return Response.json({})
      }
      if (req.method === 'DELETE') {
        state.identities.delete(name)
        return Response.json({})
      }
      return Response.json({
        VerifiedForSendingStatus: id.verified,
        DkimAttributes: { Status: id.dkim, Tokens: id.tokens },
        MailFromAttributes: {
          MailFromDomain: id.mailFrom,
          MailFromDomainStatus: id.verified ? 'SUCCESS' : 'PENDING',
        },
      })
    }
    const set = /^\/configuration-sets\/(.+)$/.exec(path)?.[1]
    if (set) {
      return state.configurationSets.has(decodeURIComponent(set))
        ? Response.json({ ConfigurationSetName: decodeURIComponent(set) })
        : Response.json(
            { message: 'not found' },
            { status: 404, headers: { 'x-amzn-errortype': 'NotFoundException' } },
          )
    }
    return Response.json({ message: `unmocked ${req.method} ${path}` }, { status: 500 })
  })
  return { state, restore: () => spy.mockRestore() }
}
