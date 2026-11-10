/**
 * Amazon SNS message verification with WebCrypto (no SDK). Steps, per AWS documentation:
 * the signing certificate URL must be an SNS host, the certificate's public key verifies the
 * canonical string, and SignatureVersion 1 = RSA-SHA1, 2 = RSA-SHA256.
 */

export interface SnsMessage {
  Type: 'Notification' | 'SubscriptionConfirmation' | 'UnsubscribeConfirmation'
  MessageId: string
  TopicArn: string
  Subject?: string
  Message: string
  Timestamp: string
  SignatureVersion: '1' | '2'
  Signature: string
  SigningCertURL: string
  SubscribeURL?: string
  Token?: string
}

const CERT_HOST = /^sns\.[a-z0-9-]+\.amazonaws\.com(\.cn)?$/

export function isSnsUrl(raw: string | undefined, pathPattern: RegExp): boolean {
  if (!raw) return false
  try {
    const u = new URL(raw)
    return u.protocol === 'https:' && CERT_HOST.test(u.hostname) && pathPattern.test(u.pathname)
  } catch {
    return false
  }
}

export function stringToSign(m: SnsMessage): string {
  const keys =
    m.Type === 'Notification'
      ? [
          'Message',
          'MessageId',
          ...(m.Subject !== undefined ? ['Subject'] : []),
          'Timestamp',
          'TopicArn',
          'Type',
        ]
      : ['Message', 'MessageId', 'SubscribeURL', 'Timestamp', 'Token', 'TopicArn', 'Type']
  return keys.map((k) => `${k}\n${(m as unknown as Record<string, string>)[k]}\n`).join('')
}

/** Minimal DER reader: returns [tag, headerLength, contentLength] at `offset`. */
function tlv(der: Uint8Array, offset: number): [number, number, number] {
  const tag = der[offset]!
  let len = der[offset + 1]!
  let header = 2
  if (len & 0x80) {
    const n = len & 0x7f
    len = 0
    for (let i = 0; i < n; i++) len = (len << 8) | der[offset + 2 + i]!
    header += n
  }
  return [tag, header, len]
}

/** Extracts SubjectPublicKeyInfo from an X.509 certificate (DER). */
export function spkiFromCertificate(der: Uint8Array): Uint8Array {
  const [, certHeader] = tlv(der, 0)
  let p = certHeader
  const [, tbsHeader] = tlv(der, p)
  p += tbsHeader // inside TBSCertificate
  // version [0] EXPLICIT (optional), serial, signature, issuer, validity, subject, spki
  if (der[p] === 0xa0) {
    const [, h, l] = tlv(der, p)
    p += h + l
  }
  for (let i = 0; i < 5; i++) {
    const [, h, l] = tlv(der, p)
    p += h + l
  }
  const [tag, h, l] = tlv(der, p)
  if (tag !== 0x30) throw new Error('Malformed certificate')
  return der.slice(p, p + h + l)
}

export function pemToDer(pem: string): Uint8Array {
  const body = pem.replace(/-----(BEGIN|END) CERTIFICATE-----/g, '').replace(/\s+/g, '')
  return Uint8Array.from(atob(body), (c) => c.charCodeAt(0))
}

const keyCache = new Map<string, Promise<CryptoKey>>()

async function certificateKey(
  url: string,
  hash: 'SHA-1' | 'SHA-256',
  fetcher: typeof fetch,
): Promise<CryptoKey> {
  const cacheKey = `${hash} ${url}`
  let key = keyCache.get(cacheKey)
  if (!key) {
    key = (async () => {
      const res = await fetcher(url)
      if (!res.ok) throw new Error(`Cannot fetch SNS certificate: ${res.status}`)
      const spki = spkiFromCertificate(pemToDer(await res.text()))
      return crypto.subtle.importKey('spki', spki, { name: 'RSASSA-PKCS1-v1_5', hash }, false, [
        'verify',
      ])
    })()
    keyCache.set(cacheKey, key)
    key.catch(() => keyCache.delete(cacheKey))
  }
  return key
}

export async function verifySnsMessage(
  m: SnsMessage,
  fetcher: typeof fetch = fetch,
): Promise<boolean> {
  if (m.SignatureVersion !== '1' && m.SignatureVersion !== '2') return false
  if (!isSnsUrl(m.SigningCertURL, /^\/SimpleNotificationService-[A-Za-z0-9]+\.pem$/)) return false
  const hash = m.SignatureVersion === '2' ? 'SHA-256' : 'SHA-1'
  try {
    const key = await certificateKey(m.SigningCertURL, hash, fetcher)
    const sig = Uint8Array.from(atob(m.Signature), (c) => c.charCodeAt(0))
    return await crypto.subtle.verify(
      'RSASSA-PKCS1-v1_5',
      key,
      sig,
      new TextEncoder().encode(stringToSign(m)),
    )
  } catch {
    return false
  }
}

export function clearSnsKeyCache() {
  keyCache.clear()
}
