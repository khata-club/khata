/**
 * Outbound webhook catalog and signing (spec §11), following the Standard Webhooks scheme:
 * `webhook-id`, `webhook-timestamp` and `webhook-signature: v1,<base64 HMAC-SHA256>` over
 * `${id}.${timestamp}.${body}`. Secrets are `whsec_<base64>`. Shared by the API (signing)
 * and the SDK (verification).
 */
import { z } from 'zod'

export const WEBHOOK_SCHEMA_VERSION = '2026-11-01'

export const WEBHOOK_EVENT_TYPES = [
  'email.accepted',
  'email.submitted',
  'email.delayed',
  'email.delivered',
  'email.bounced',
  'email.complained',
  'email.suppressed',
  'email.rejected',
  'email.expired',
  'email.cancelled',
  'email.submission_uncertain',
  'email.opened',
  'email.clicked',
] as const
export const WebhookEventType = z.enum(WEBHOOK_EVENT_TYPES)
export type WebhookEventType = z.infer<typeof WebhookEventType>

export interface WebhookPayload<T = Record<string, unknown>> {
  /** Stable event ID; replays and retries reuse it so consumers can deduplicate. */
  id: string
  type: WebhookEventType | 'webhook.test'
  schemaVersion: string
  createdAt: string
  data: T
}

const enc = new TextEncoder()

function b64(bytes: ArrayBuffer | Uint8Array): string {
  let s = ''
  for (const b of new Uint8Array(bytes)) s += String.fromCharCode(b)
  return btoa(s)
}

function secretBytes(secret: string): Uint8Array {
  const raw = secret.startsWith('whsec_') ? secret.slice(6) : secret
  return Uint8Array.from(atob(raw), (c) => c.charCodeAt(0))
}

/** The slice of Web Crypto used here (this package compiles without DOM types). */
interface Subtle {
  importKey(
    format: 'raw',
    key: Uint8Array,
    alg: { name: 'HMAC'; hash: 'SHA-256' },
    extractable: boolean,
    usages: 'sign'[],
  ): Promise<unknown>
  sign(alg: 'HMAC', key: unknown, data: Uint8Array): Promise<ArrayBuffer>
}
const subtle = (globalThis as unknown as { crypto: { subtle: Subtle } }).crypto.subtle
const random = (
  globalThis as unknown as { crypto: { getRandomValues<T extends Uint8Array>(a: T): T } }
).crypto

export function generateWebhookSecret(): string {
  return `whsec_${b64(random.getRandomValues(new Uint8Array(32)))}`
}

export async function signWebhook(
  secret: string,
  id: string,
  timestamp: number,
  body: string,
): Promise<string> {
  const key = await subtle.importKey(
    'raw',
    secretBytes(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const sig = await subtle.sign('HMAC', key, enc.encode(`${id}.${timestamp}.${body}`))
  return `v1,${b64(sig)}`
}

/** Headers for a delivery. During secret rotation both signatures are sent. */
export async function webhookHeaders(
  secrets: string[],
  id: string,
  body: string,
  now = Date.now(),
) {
  const timestamp = Math.floor(now / 1000)
  const signatures = await Promise.all(secrets.map((s) => signWebhook(s, id, timestamp, body)))
  return {
    'webhook-id': id,
    'webhook-timestamp': String(timestamp),
    'webhook-signature': signatures.join(' '),
  }
}

export class WebhookVerificationError extends Error {
  override readonly name = 'WebhookVerificationError'
}

/**
 * Verifies a delivery: any `v1` signature may match, and the timestamp must be within
 * `toleranceSeconds` (replay protection). Returns the parsed payload.
 */
export async function verifyWebhook<T = Record<string, unknown>>(
  secret: string,
  body: string,
  headers: Record<string, string | null | undefined> | Headers,
  { toleranceSeconds = 300, now = Date.now() } = {},
): Promise<WebhookPayload<T>> {
  const get = (k: string) =>
    headers instanceof Headers ? headers.get(k) : (headers[k] ?? headers[k.toLowerCase()])
  const id = get('webhook-id')
  const ts = Number(get('webhook-timestamp'))
  const sigs = (get('webhook-signature') ?? '').split(' ')
  if (!id || !Number.isFinite(ts) || !sigs.length)
    throw new WebhookVerificationError('Missing webhook headers.')
  if (Math.abs(now / 1000 - ts) > toleranceSeconds)
    throw new WebhookVerificationError('Timestamp outside tolerance.')
  const expected = await signWebhook(secret, id, ts, body)
  // Length-checked comparison; HMAC outputs are fixed length.
  const ok = sigs.some((s) => s.length === expected.length && timingSafeEqual(s, expected))
  if (!ok) throw new WebhookVerificationError('No matching signature.')
  return JSON.parse(body) as WebhookPayload<T>
}

function timingSafeEqual(a: string, b: string) {
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

/** Retry schedule: 30s, 1m, 2m, 4m … capped at 6h; dead after `MAX_WEBHOOK_ATTEMPTS`. */
export const MAX_WEBHOOK_ATTEMPTS = 10
export function webhookBackoffSeconds(attempt: number): number {
  return Math.min(6 * 3600, 30 * 2 ** Math.max(0, attempt - 1))
}
