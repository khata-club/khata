import { describe, expect, it } from 'vitest'

import { domainOf, parseMailbox, SendEmailInput } from './email.ts'

describe('parseMailbox', () => {
  it('parses bare and named addresses', () => {
    expect(parseMailbox('A@Example.COM')).toEqual({ address: 'a@example.com' })
    expect(parseMailbox('Acme Support <help@acme.dev>')).toEqual({
      address: 'help@acme.dev',
      name: 'Acme Support',
    })
    expect(parseMailbox('"Acme, Inc" <help@acme.dev>')).toEqual({
      address: 'help@acme.dev',
      name: 'Acme, Inc',
    })
  })
  it('rejects invalid input', () => {
    for (const bad of ['', 'nope', 'a@b', 'a b@c.d', '<>', 'x <a@b>'])
      expect(parseMailbox(bad)).toBeNull()
  })
  it('extracts the domain', () => {
    expect(domainOf('a@mail.acme.dev')).toBe('mail.acme.dev')
  })
})

describe('SendEmailInput', () => {
  const base = { from: 'a@acme.dev', to: 'b@x.dev', subject: 'Hi', html: '<p>Hi</p>' }
  it('defaults the stream to transactional', () => {
    expect(SendEmailInput.parse(base).stream).toBe('transactional')
  })
  it('requires content and a subject', () => {
    const r = SendEmailInput.safeParse({ from: 'a@acme.dev', to: 'b@x.dev' })
    expect(r.success).toBe(false)
    expect(r.error!.issues.map((i) => i.path.join('.'))).toEqual(['html', 'subject'])
  })
  it('refuses reserved headers', () => {
    const r = SendEmailInput.safeParse({ ...base, headers: { Bcc: 'x@y.z', 'X-Ok': '1' } })
    expect(r.error!.issues.map((i) => i.path.join('.'))).toEqual(['headers.Bcc'])
  })
  it('requires expiry after schedule', () => {
    const r = SendEmailInput.safeParse({
      ...base,
      scheduledAt: '2026-11-05T10:00:00Z',
      expiresAt: '2026-11-05T09:00:00Z',
    })
    expect(r.success).toBe(false)
  })
})
