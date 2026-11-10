/**
 * RFC 5322 / MIME message builder. Pure and dependency-free so it runs in Workers.
 *
 * Structure: mixed(attachments) > related(inline images) > alternative(text, html).
 * BCC addresses are never written into headers: they travel only in the SES envelope
 * (`Destination.BccAddresses`), so no recipient can see them.
 */
import type { Attachment } from '@khata/dak-core'

export interface MimeInput {
  from: string
  to: string[]
  cc: string[]
  replyTo: string[]
  subject: string
  text?: string
  html?: string
  headers: Record<string, string>
  attachments: Attachment[]
  messageId: string
  date?: Date
}

const CRLF = '\r\n'
const enc = new TextEncoder()

function b64(bytes: Uint8Array): string {
  let s = ''
  for (let i = 0; i < bytes.length; i += 0x8000)
    s += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(s)
}

export function base64Utf8(text: string): string {
  return b64(enc.encode(text))
}

function wrap76(s: string): string {
  return s.replace(/.{1,76}/g, (m) => m + CRLF).trimEnd()
}

/** RFC 2047 encoded-word when the value is not plain ASCII. */
export function encodeHeader(value: string): string {
  if (/^[\x20-\x7e]*$/.test(value)) return value
  return `=?UTF-8?B?${base64Utf8(value)}?=`
}

/** `Name <addr>` with the display name encoded as needed. */
export function encodeAddress(mailbox: string): string {
  const m = /^(.*?)\s*<([^>]+)>$/.exec(mailbox)
  if (!m || !m[1]) return mailbox
  const name =
    m[1].length > 1 && m[1].startsWith('"') && m[1].endsWith('"') ? m[1].slice(1, -1) : m[1]
  const encoded = /^[\x20-\x7e]*$/.test(name)
    ? `"${name.replace(/(["\\])/g, '\\$1')}"`
    : encodeHeader(name)
  return `${encoded} <${m[2]}>`
}

function boundary(tag: string) {
  return `=_dak_${tag}_${crypto.randomUUID().replace(/-/g, '')}`
}

function part(contentType: string, body: string, extra: string[] = []): string {
  return [
    `Content-Type: ${contentType}`,
    'Content-Transfer-Encoding: base64',
    ...extra,
    '',
    wrap76(body),
  ].join(CRLF)
}

function multipart(type: string, tag: string, parts: string[]): string {
  const b = boundary(tag)
  return [
    `Content-Type: multipart/${type}; boundary="${b}"`,
    '',
    ...parts.flatMap((p) => [`--${b}`, p]),
    `--${b}--`,
  ].join(CRLF)
}

function filenameParam(name: string) {
  return /^[\x20-\x7e]*$/.test(name) ? `"${name.replace(/"/g, '')}"` : `"${encodeHeader(name)}"`
}

export function buildMime(input: MimeInput): string {
  const bodies: string[] = []
  if (input.text !== undefined)
    bodies.push(part('text/plain; charset=UTF-8', base64Utf8(input.text)))
  if (input.html !== undefined)
    bodies.push(part('text/html; charset=UTF-8', base64Utf8(input.html)))
  let body = bodies.length === 1 ? bodies[0]! : multipart('alternative', 'alt', bodies)

  const inline = input.attachments.filter((a) => a.contentId)
  const files = input.attachments.filter((a) => !a.contentId)
  if (inline.length) {
    body = multipart('related', 'rel', [
      body,
      ...inline.map((a) =>
        part(a.contentType ?? 'application/octet-stream', a.content.replace(/\s+/g, ''), [
          `Content-ID: <${a.contentId}>`,
          `Content-Disposition: inline; filename=${filenameParam(a.filename)}`,
        ]),
      ),
    ])
  }
  if (files.length) {
    body = multipart('mixed', 'mix', [
      body,
      ...files.map((a) =>
        part(a.contentType ?? 'application/octet-stream', a.content.replace(/\s+/g, ''), [
          `Content-Disposition: attachment; filename=${filenameParam(a.filename)}`,
        ]),
      ),
    ])
  }

  const headers = [
    `From: ${encodeAddress(input.from)}`,
    `To: ${input.to.map(encodeAddress).join(', ')}`,
    ...(input.cc.length ? [`Cc: ${input.cc.map(encodeAddress).join(', ')}`] : []),
    ...(input.replyTo.length ? [`Reply-To: ${input.replyTo.map(encodeAddress).join(', ')}`] : []),
    `Subject: ${encodeHeader(input.subject)}`,
    `Date: ${(input.date ?? new Date()).toUTCString().replace('GMT', '+0000')}`,
    `Message-ID: <${input.messageId}>`,
    'MIME-Version: 1.0',
    ...Object.entries(input.headers).map(
      ([k, v]) => `${k}: ${encodeHeader(v.replace(/[\r\n]+/g, ' '))}`,
    ),
  ]
  return headers.join(CRLF) + CRLF + body + CRLF
}
