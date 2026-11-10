/**
 * Webhook destinations must be public HTTPS endpoints. Literal private, loopback and
 * link-local addresses and internal names are refused (SSRF protection, spec §15).
 */
export function webhookUrlProblem(raw: string): string | null {
  let u: URL
  try {
    u = new URL(raw)
  } catch {
    return 'Enter a full URL.'
  }
  if (u.protocol !== 'https:') return 'Webhook URLs must use https.'
  if (u.username || u.password) return 'Credentials in the URL are not allowed.'
  const host = u.hostname.toLowerCase().replace(/^\[|\]$/g, '')
  if (
    host === 'localhost' ||
    host.endsWith('.localhost') ||
    host.endsWith('.local') ||
    host.endsWith('.internal')
  ) {
    return 'Internal hostnames are not allowed.'
  }
  const v4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host)
  if (v4) {
    const [a, b] = [Number(v4[1]), Number(v4[2])]
    if (
      a === 10 ||
      a === 127 ||
      a === 0 ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 100 && b >= 64 && b <= 127) ||
      a >= 224
    ) {
      return 'Private and reserved IP addresses are not allowed.'
    }
  }
  if (
    host.includes(':') &&
    (host === '::1' ||
      host.startsWith('fc') ||
      host.startsWith('fd') ||
      host.startsWith('fe80') ||
      host === '::')
  ) {
    return 'Private and reserved IP addresses are not allowed.'
  }
  if (!host.includes('.') && !host.includes(':')) return 'Use a fully qualified hostname.'
  return null
}
