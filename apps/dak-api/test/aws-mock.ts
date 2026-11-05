import { vi } from 'vitest'

export interface AwsMockState {
  account: Record<string, unknown>
  /** Names of configuration sets that exist. */
  configurationSets: Set<string>
  assumeFails?: string
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
    calls: [],
    ...initial,
  }
  const real = globalThis.fetch
  const spy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init = {}) => {
    const req = new Request(input as RequestInfo, init)
    const url = new URL(req.url)
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
