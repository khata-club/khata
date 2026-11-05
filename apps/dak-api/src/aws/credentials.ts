import { open } from '../lib/crypto'
import { HttpError } from '../lib/errors'
import type { AwsCredentials } from './ses'
import { assumeRole } from './sts'

export interface ConnectionLike {
  id: string
  mode: 'platform' | 'byo'
  region: string
  roleArn: string | null
  externalIdEnc: string | null
  configurationSetPrefix: string | null
}

export type BrokerEnv = Pick<Env, 'DAK_ENV'> &
  Partial<Pick<Env, 'AWS_ACCESS_KEY_ID' | 'AWS_SECRET_ACCESS_KEY' | 'DAK_DATA_KEY'>>

export function brokerCredentials(env: BrokerEnv, region: string): AwsCredentials {
  if (!env.AWS_ACCESS_KEY_ID || !env.AWS_SECRET_ACCESS_KEY) {
    throw new HttpError(503, 'aws_not_configured', 'Platform AWS credentials are not configured.')
  }
  return { accessKeyId: env.AWS_ACCESS_KEY_ID, secretAccessKey: env.AWS_SECRET_ACCESS_KEY, region }
}

// Per-isolate cache of assumed-role credentials, refreshed 5 minutes before expiry.
const cache = new Map<string, { creds: AwsCredentials; expiresAt: number }>()
const MARGIN_MS = 5 * 60_000

/**
 * Credentials for sending through a connection. BYO connections assume the customer's role;
 * there is deliberately no fallback to platform credentials (spec §3).
 */
export async function connectionCredentials(
  env: BrokerEnv,
  conn: ConnectionLike,
): Promise<AwsCredentials> {
  if (conn.mode === 'platform') return brokerCredentials(env, conn.region)
  if (!conn.roleArn || !conn.externalIdEnc) {
    throw new HttpError(409, 'connection_incomplete', 'This AWS connection has no role yet.')
  }
  const hit = cache.get(conn.id)
  if (hit && hit.expiresAt - MARGIN_MS > Date.now()) return hit.creds
  const assumed = await assumeRole(brokerCredentials(env, conn.region), {
    roleArn: conn.roleArn,
    externalId: await open(env.DAK_DATA_KEY, conn.externalIdEnc),
    sessionName: `dak-${conn.id}`,
  })
  cache.set(conn.id, { creds: assumed, expiresAt: assumed.expiresAt })
  return assumed
}

export function clearCredentialCache(connectionId?: string) {
  if (connectionId) cache.delete(connectionId)
  else cache.clear()
}
