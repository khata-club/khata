/** DNS records a customer publishes for a sending domain (spec §7). Pure; unit-tested. */

export type RecordPurpose = 'dkim' | 'mail_from_mx' | 'mail_from_spf' | 'dmarc'

export interface DnsRecord {
  purpose: RecordPurpose
  type: 'CNAME' | 'MX' | 'TXT'
  /** Fully-qualified host name. */
  name: string
  value: string
  priority?: number
  /** `merge` = edit the existing record instead of adding a second one. */
  action: 'add' | 'merge' | 'optional'
  note?: string
}

export const DEFAULT_MAIL_FROM_LABEL = 'send'

export function mailFromDomain(domain: string, label = DEFAULT_MAIL_FROM_LABEL) {
  return `${label}.${domain}`
}

const SES_INCLUDE = 'include:amazonses.com'

/**
 * Merge Amazon SES into an SPF record without creating a second record for the same host
 * (two SPF records make SPF fail with permerror). Returns null when already included.
 */
export function mergeSpf(existing: string): string | null {
  const record = existing.trim().replace(/^"|"$/g, '')
  if (!/^v=spf1(\s|$)/i.test(record)) throw new Error('Not an SPF record')
  if (record.split(/\s+/).some((t) => t.toLowerCase() === SES_INCLUDE)) return null
  const parts = record.split(/\s+/)
  const allIdx = parts.findIndex((t) => /^[~?+-]?all$/i.test(t) || /^redirect=/i.test(t))
  if (allIdx === -1) parts.push(SES_INCLUDE)
  else parts.splice(allIdx, 0, SES_INCLUDE)
  return parts.join(' ')
}

export function spfRecordsIn(txt: string[]): string[] {
  return txt
    .map((t) => t.replace(/^"|"$/g, '').replace(/"\s*"/g, ''))
    .filter((t) => /^v=spf1(\s|$)/i.test(t))
}

export interface BuildRecordsInput {
  domain: string
  region: string
  dkimTokens: string[]
  mailFrom?: string
  /** Existing TXT records at the MAIL FROM host (from DNS). */
  existingMailFromTxt?: string[]
  /** Existing TXT records at `_dmarc.<domain>`. */
  existingDmarcTxt?: string[]
}

export function buildRecords(input: BuildRecordsInput): DnsRecord[] {
  const records: DnsRecord[] = input.dkimTokens.map((t) => ({
    purpose: 'dkim',
    type: 'CNAME',
    name: `${t}._domainkey.${input.domain}`,
    value: `${t}.dkim.amazonses.com`,
    action: 'add',
  }))

  const mailFrom = input.mailFrom ?? mailFromDomain(input.domain)
  records.push({
    purpose: 'mail_from_mx',
    type: 'MX',
    name: mailFrom,
    value: `feedback-smtp.${input.region}.amazonses.com`,
    priority: 10,
    action: 'add',
  })

  const spf = spfRecordsIn(input.existingMailFromTxt ?? [])
  if (spf.length === 0) {
    records.push({
      purpose: 'mail_from_spf',
      type: 'TXT',
      name: mailFrom,
      value: `v=spf1 ${SES_INCLUDE} ~all`,
      action: 'add',
    })
  } else {
    const merged = mergeSpf(spf[0]!)
    records.push({
      purpose: 'mail_from_spf',
      type: 'TXT',
      name: mailFrom,
      value: merged ?? spf[0]!,
      action: merged ? 'merge' : 'optional',
      note: merged
        ? `Replace the existing SPF record "${spf[0]}"; do not add a second one.`
        : 'Already includes Amazon SES.',
    })
  }

  const hasDmarc = (input.existingDmarcTxt ?? []).some((t) => /v=DMARC1/i.test(t))
  records.push({
    purpose: 'dmarc',
    type: 'TXT',
    name: `_dmarc.${input.domain}`,
    value: 'v=DMARC1; p=none;',
    action: 'optional',
    note: hasDmarc
      ? 'A DMARC policy already exists.'
      : 'Recommended. Start with p=none, monitor reports, then move to quarantine or reject.',
  })
  return records
}

const DOMAIN_RE = /^(?=.{1,253}$)(?!-)([a-z0-9-]{1,63}(?<!-)\.)+[a-z]{2,63}$/

export function normalizeDomain(input: string): string | null {
  const d = input.trim().toLowerCase().replace(/\.$/, '')
  return DOMAIN_RE.test(d) ? d : null
}
