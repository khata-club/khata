import { z } from 'zod'

/**
 * API key scopes. Keys are restricted by default: `emails:send` only. Scopes never grant
 * dashboard-only powers (billing, members, AWS).
 */
export const API_SCOPES = [
  'emails:send',
  'emails:read',
  'emails:cancel',
  'templates:read',
  'domains:read',
  'analytics:read',
  'suppressions:manage',
] as const

export const ApiScope = z.enum(API_SCOPES)
export type ApiScope = z.infer<typeof ApiScope>

export const DEFAULT_SCOPES: ApiScope[] = ['emails:send']

/** `dak_live_` for production/staging environments, `dak_test_` for sandbox. */
export function keyPrefixFor(kind: 'production' | 'staging' | 'sandbox') {
  return kind === 'sandbox' ? 'dak_test_' : 'dak_live_'
}
