import { describe, expect, it } from 'vitest'

import { buildRecords, mergeSpf, normalizeDomain } from '../src/domains/records'

describe('mergeSpf', () => {
  it('inserts the SES include before the all mechanism', () => {
    expect(mergeSpf('v=spf1 include:_spf.google.com ~all')).toBe(
      'v=spf1 include:_spf.google.com include:amazonses.com ~all',
    )
  })
  it('appends when there is no all mechanism', () => {
    expect(mergeSpf('v=spf1 mx')).toBe('v=spf1 mx include:amazonses.com')
  })
  it('returns null when SES is already included', () => {
    expect(mergeSpf('v=spf1 include:amazonses.com -all')).toBeNull()
  })
  it('rejects non-SPF input', () => {
    expect(() => mergeSpf('google-site-verification=abc')).toThrow()
  })
})

describe('buildRecords', () => {
  const base = { domain: 'acme.dev', region: 'eu-west-1', dkimTokens: ['a', 'b', 'c'] }

  it('lists DKIM, MAIL FROM MX, SPF and DMARC', () => {
    const r = buildRecords(base)
    expect(r.filter((x) => x.purpose === 'dkim').map((x) => [x.name, x.value])).toEqual([
      ['a._domainkey.acme.dev', 'a.dkim.amazonses.com'],
      ['b._domainkey.acme.dev', 'b.dkim.amazonses.com'],
      ['c._domainkey.acme.dev', 'c.dkim.amazonses.com'],
    ])
    expect(r.find((x) => x.purpose === 'mail_from_mx')).toMatchObject({
      name: 'send.acme.dev',
      value: 'feedback-smtp.eu-west-1.amazonses.com',
      priority: 10,
    })
    expect(r.find((x) => x.purpose === 'mail_from_spf')).toMatchObject({
      action: 'add',
      value: 'v=spf1 include:amazonses.com ~all',
    })
  })

  it('never proposes a second SPF record for a host that has one', () => {
    const r = buildRecords({
      ...base,
      existingMailFromTxt: ['v=spf1 include:mailgun.org ~all', 'other=1'],
    })
    const spf = r.filter((x) => x.purpose === 'mail_from_spf')
    expect(spf).toHaveLength(1)
    expect(spf[0]).toMatchObject({
      action: 'merge',
      value: 'v=spf1 include:mailgun.org include:amazonses.com ~all',
    })
  })

  it('notes an existing DMARC policy', () => {
    const r = buildRecords({ ...base, existingDmarcTxt: ['v=DMARC1; p=reject'] })
    expect(r.find((x) => x.purpose === 'dmarc')?.note).toMatch(/already exists/)
  })
})

describe('normalizeDomain', () => {
  it('lower-cases and strips the trailing dot', () => {
    expect(normalizeDomain(' Mail.Acme.DEV. ')).toBe('mail.acme.dev')
  })
  it('rejects junk', () => {
    for (const bad of ['acme', 'http://acme.dev', '-acme.dev', 'a..b.com', 'acme.dev/x']) {
      expect(normalizeDomain(bad)).toBeNull()
    }
  })
})
