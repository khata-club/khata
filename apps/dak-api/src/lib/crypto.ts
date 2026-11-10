/**
 * Envelope encryption for secrets stored in D1 (BYO ExternalIds, webhook signing secrets).
 * AES-256-GCM with a random 96-bit IV; the key comes from the DAK_DATA_KEY secret.
 * Format: `v1.<iv b64url>.<ciphertext b64url>` so the key can be rotated later.
 */

const enc = new TextEncoder()
const dec = new TextDecoder()

export function b64url(bytes: Uint8Array): string {
  let s = ''
  for (const b of bytes) s += String.fromCharCode(b)
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export function fromB64url(s: string): Uint8Array {
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/'))
  return Uint8Array.from(bin, (c) => c.charCodeAt(0))
}

async function key(dataKey: string | undefined): Promise<CryptoKey> {
  if (!dataKey) throw new Error('DAK_DATA_KEY is not configured')
  const raw = Uint8Array.from(atob(dataKey), (c) => c.charCodeAt(0))
  if (raw.length !== 32) throw new Error('DAK_DATA_KEY must be 32 bytes, base64-encoded')
  return crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt', 'decrypt'])
}

export async function seal(dataKey: string | undefined, plaintext: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const ct = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    await key(dataKey),
    enc.encode(plaintext),
  )
  return `v1.${b64url(iv)}.${b64url(new Uint8Array(ct))}`
}

export async function open(dataKey: string | undefined, sealed: string): Promise<string> {
  const [version, iv, ct] = sealed.split('.')
  if (version !== 'v1' || !iv || !ct) throw new Error('Unsupported sealed value')
  const pt = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: fromB64url(iv) },
    await key(dataKey),
    fromB64url(ct),
  )
  return dec.decode(pt)
}

/** URL-safe random token, e.g. ExternalIds and webhook secrets. */
export function randomToken(bytes = 24): string {
  return b64url(crypto.getRandomValues(new Uint8Array(bytes)))
}

export async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', enc.encode(input))
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
}
