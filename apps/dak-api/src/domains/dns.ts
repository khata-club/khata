/** DNS-over-HTTPS lookups (Cloudflare resolver) for verification and health checks. */

const TYPES = { TXT: 16, CNAME: 5, MX: 15 } as const

export async function resolve(name: string, type: keyof typeof TYPES): Promise<string[]> {
  const url = `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(name)}&type=${type}`
  const res = await fetch(url, { headers: { accept: 'application/dns-json' } })
  if (!res.ok) throw new Error(`DNS lookup failed: ${res.status}`)
  const body = (await res.json()) as { Status: number; Answer?: { type: number; data: string }[] }
  return (body.Answer ?? [])
    .filter((a) => a.type === TYPES[type])
    .map((a) => {
      const data = a.data.replace(/\.$/, '')
      if (type === 'TXT') return data.replace(/^"|"$/g, '').replace(/"\s*"/g, '')
      if (type === 'MX') return data.replace(/^\d+\s+/, '').replace(/\.$/, '')
      return data
    })
}
