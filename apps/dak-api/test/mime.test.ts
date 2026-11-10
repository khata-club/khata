import { describe, expect, it } from 'vitest'

import { buildMime, encodeAddress, encodeHeader } from '../src/sending/mime'

const base = {
  from: 'Acme <hello@acme.dev>',
  to: ['ada@example.com'],
  cc: [],
  replyTo: [],
  subject: 'Hello',
  headers: {},
  attachments: [],
  messageId: 'em_1@dak.khata.club',
}

function decodeParts(raw: string) {
  return [
    ...raw.matchAll(
      /Content-Transfer-Encoding: base64\r\n(?:[^\r\n]+\r\n)*\r\n([A-Za-z0-9+/=\r\n]+?)\r\n(?:--|$)/g,
    ),
  ].map((m) =>
    new TextDecoder().decode(
      Uint8Array.from(atob(m[1]!.replace(/\r\n/g, '')), (c) => c.charCodeAt(0)),
    ),
  )
}

describe('buildMime', () => {
  it('builds multipart/alternative with text and html', () => {
    const raw = buildMime({ ...base, text: 'Hi', html: '<p>Hi</p>' })
    expect(raw).toMatch(/^From: "Acme" <hello@acme.dev>\r\n/)
    expect(raw).toContain('Content-Type: multipart/alternative')
    expect(raw).toContain('Message-ID: <em_1@dak.khata.club>')
    expect(decodeParts(raw)).toEqual(['Hi', '<p>Hi</p>'])
  })

  it('never writes a Bcc header', () => {
    const raw = buildMime({ ...base, text: 'x', headers: { 'X-Campaign': 'c1' } })
    expect(raw).not.toMatch(/^Bcc:/im)
    expect(raw).toContain('X-Campaign: c1')
  })

  it('encodes non-ASCII subjects, names and bodies', () => {
    const raw = buildMime({
      ...base,
      from: 'Zoë <z@acme.dev>',
      subject: 'Ваш код',
      text: 'naïve ✓',
    })
    expect(raw).toContain(`Subject: ${encodeHeader('Ваш код')}`)
    expect(raw).toMatch(/^From: =\?UTF-8\?B\?/m)
    expect(decodeParts(raw)).toEqual(['naïve ✓'])
  })

  it('nests inline images in related and files in mixed', () => {
    const raw = buildMime({
      ...base,
      html: '<img src="cid:logo">',
      attachments: [
        { filename: 'logo.png', content: btoa('png'), contentType: 'image/png', contentId: 'logo' },
        { filename: 'invoice.pdf', content: btoa('pdf'), contentType: 'application/pdf' },
      ],
    })
    const mixed = raw.indexOf('multipart/mixed')
    const related = raw.indexOf('multipart/related')
    expect(mixed).toBeGreaterThan(-1)
    expect(related).toBeGreaterThan(mixed)
    expect(raw).toContain('Content-ID: <logo>')
    expect(raw).toContain('Content-Disposition: attachment; filename="invoice.pdf"')
  })

  it('quotes display names safely', () => {
    expect(encodeAddress('Acme "Ops" <o@a.dev>')).toBe('"Acme \\"Ops\\"" <o@a.dev>')
    expect(encodeAddress('o@a.dev')).toBe('o@a.dev')
  })
})
