/**
 * Public identifiers: a short type prefix plus a ULID, e.g. `em_01JC3Z…`.
 *
 * ULIDs sort by creation time, which keeps D1 index inserts append-mostly and lets list
 * endpoints page by ID. Provider identifiers (SES message IDs) are never used as public keys.
 */

export const ID_PREFIXES = {
  organization: 'org',
  workspace: 'ws',
  project: 'prj',
  environment: 'env',
  awsConnection: 'awc',
  domain: 'dom',
  sender: 'snd',
  apiKey: 'key',
  template: 'tpl',
  templateVersion: 'tpv',
  email: 'em',
  emailRecipient: 'rcp',
  sendAttempt: 'att',
  emailEvent: 'evt',
  suppression: 'sup',
  webhookEndpoint: 'whe',
  webhookDelivery: 'whd',
  usageEntry: 'use',
  auditEvent: 'aud',
} as const

export type IdKind = keyof typeof ID_PREFIXES
export type IdPrefix = (typeof ID_PREFIXES)[IdKind]

/** Crockford base32, as used by ULID. */
const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'
const TIME_LEN = 10
const RANDOM_LEN = 16
const ULID_LEN = TIME_LEN + RANDOM_LEN
const MAX_TIME = 2 ** 48 - 1

// Web Crypto is global in browsers, Workers and Node ≥ 19; typed locally because this package
// compiles without DOM or Node lib types.
const webCrypto = (
  globalThis as unknown as { crypto: { getRandomValues<T extends Uint8Array>(array: T): T } }
).crypto

export function ulid(now: number = Date.now()): string {
  if (!Number.isInteger(now) || now < 0 || now > MAX_TIME) {
    throw new RangeError(`ulid: timestamp out of range: ${now}`)
  }
  let time = ''
  let t = now
  for (let i = 0; i < TIME_LEN; i++) {
    time = ALPHABET[t % 32] + time
    t = Math.floor(t / 32)
  }
  // 16 random chars × 5 bits = 80 bits; one byte per char, keeping the low 5 bits.
  const bytes = webCrypto.getRandomValues(new Uint8Array(RANDOM_LEN))
  let random = ''
  for (const b of bytes) random += ALPHABET[b & 31]
  return time + random
}

/** Milliseconds since the epoch encoded in a ULID. */
export function ulidTime(id: string): number {
  let t = 0
  for (const ch of id.slice(0, TIME_LEN)) {
    const v = ALPHABET.indexOf(ch)
    if (v < 0) throw new SyntaxError(`ulidTime: invalid character ${ch}`)
    t = t * 32 + v
  }
  return t
}

export function newId<K extends IdKind>(
  kind: K,
  now?: number,
): `${(typeof ID_PREFIXES)[K]}_${string}` {
  return `${ID_PREFIXES[kind]}_${ulid(now)}`
}

const ULID_RE = new RegExp(`^[${ALPHABET}]{${ULID_LEN}}$`)

/** True when `value` is a well-formed ID of the given kind. */
export function isId(kind: IdKind, value: unknown): value is string {
  if (typeof value !== 'string') return false
  const prefix = `${ID_PREFIXES[kind]}_`
  return value.startsWith(prefix) && ULID_RE.test(value.slice(prefix.length))
}
