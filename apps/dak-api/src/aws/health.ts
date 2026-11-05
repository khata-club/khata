import { AwsError, sesV2, type AwsCredentials } from './ses'

export interface ConnectionHealth {
  ok: boolean
  checkedAt: number
  accountId?: string
  region: string
  productionAccess?: boolean
  sendingEnabled?: boolean
  enforcementStatus?: string
  quota?: { max24h: number; maxPerSecond: number; sentLast24h: number }
  /** Each check the dashboard shows, in order. */
  checks: { id: string; label: string; ok: boolean; detail?: string }[]
}

interface GetAccount {
  ProductionAccessEnabled?: boolean
  SendingEnabled?: boolean
  EnforcementStatus?: string
  SendQuota?: { Max24HourSend?: number; MaxSendRate?: number; SentLast24Hours?: number }
}

/**
 * Account, region, production access, quota and permission health (spec §3: shown before
 * sending is enabled). Never throws: failures become failed checks.
 */
export async function checkHealth(
  creds: AwsCredentials,
  opts: { configurationSetPrefix?: string | null; accountId?: string } = {},
): Promise<ConnectionHealth> {
  const checks: ConnectionHealth['checks'] = []
  const health: ConnectionHealth = {
    ok: false,
    checkedAt: Date.now(),
    region: creds.region,
    accountId: opts.accountId,
    checks,
  }

  let account: GetAccount | undefined
  try {
    account = await sesV2<GetAccount>(creds, 'GET', '/account')
    checks.push({ id: 'credentials', label: 'Dak can reach SES in this account', ok: true })
  } catch (err) {
    checks.push({
      id: 'credentials',
      label: 'Dak can reach SES in this account',
      ok: false,
      detail: describe(err),
    })
    return health
  }

  health.productionAccess = account.ProductionAccessEnabled ?? false
  health.sendingEnabled = account.SendingEnabled ?? false
  health.enforcementStatus = account.EnforcementStatus
  health.quota = {
    max24h: account.SendQuota?.Max24HourSend ?? 0,
    maxPerSecond: account.SendQuota?.MaxSendRate ?? 0,
    sentLast24h: account.SendQuota?.SentLast24Hours ?? 0,
  }
  checks.push({
    id: 'production',
    label: 'Production access (out of the SES sandbox)',
    ok: health.productionAccess,
    detail: health.productionAccess
      ? undefined
      : 'SES is in sandbox mode: only verified recipients receive mail. Request production access in the SES console.',
  })
  checks.push({
    id: 'sending',
    label: 'Account sending enabled',
    ok: health.sendingEnabled && account.EnforcementStatus !== 'SHUTDOWN',
    detail:
      account.EnforcementStatus && account.EnforcementStatus !== 'HEALTHY'
        ? `Enforcement: ${account.EnforcementStatus}`
        : undefined,
  })
  const remaining = health.quota.max24h - health.quota.sentLast24h
  checks.push({
    id: 'quota',
    label: 'Daily quota available',
    ok: health.quota.max24h < 0 || remaining > 0,
    detail: `${Math.max(0, remaining).toLocaleString('en')} of ${health.quota.max24h.toLocaleString('en')} remaining · ${health.quota.maxPerSecond}/s`,
  })

  if (opts.configurationSetPrefix) {
    try {
      await sesV2(
        creds,
        'GET',
        `/configuration-sets/${encodeURIComponent(`${opts.configurationSetPrefix}-transactional`)}`,
      )
      checks.push({ id: 'events', label: 'Event publishing configured', ok: true })
    } catch (err) {
      checks.push({
        id: 'events',
        label: 'Event publishing configured',
        ok: false,
        detail: describe(err),
      })
    }
  }

  health.ok = checks.every((c) => c.ok || c.id === 'production')
  return health
}

function describe(err: unknown): string {
  if (err instanceof AwsError) return `${err.code}: ${err.message}`
  return err instanceof Error ? err.message : String(err)
}
