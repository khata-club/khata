export interface DnsRecord {
  purpose: 'dkim' | 'mail_from_mx' | 'mail_from_spf' | 'dmarc'
  type: 'CNAME' | 'MX' | 'TXT'
  name: string
  value: string
  priority?: number
  action: 'add' | 'merge' | 'optional'
  note?: string
}

export interface Domain {
  id: string
  name: string
  region: string
  status: 'pending' | 'verified' | 'failed' | 'temporary_failure'
  dkimStatus: string
  mailFromDomain: string | null
  mailFromStatus: string | null
  spfStatus: string | null
  dmarcStatus: string | null
  records: DnsRecord[]
  lastError: string | null
  lastCheckedAt: number | null
  senders: { id: string; email: string; displayName: string | null }[]
}
