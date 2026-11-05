import { z } from 'zod'

import { Stream } from './streams.ts'

const ADDRESS_RE = /^[^\s@<>()",;:]+@[^\s@<>()",;:]+\.[^\s@<>()",;:]+$/

export interface Mailbox {
  address: string
  name?: string
}

/** Parses `a@b.c` or `Name <a@b.c>`; addresses are lower-cased. Returns null when invalid. */
export function parseMailbox(input: string): Mailbox | null {
  const s = input.trim()
  const m = /^(?:"?([^"<]*?)"?\s*)?<([^<>]+)>$/.exec(s)
  const address = (m ? m[2]! : s).trim().toLowerCase()
  if (!ADDRESS_RE.test(address) || address.length > 254) return null
  const name = m?.[1]?.trim()
  return name ? { address, name } : { address }
}

export function domainOf(address: string): string {
  return address.slice(address.lastIndexOf('@') + 1)
}

const Recipients = z.union([z.string(), z.array(z.string()).max(50)])

export const Attachment = z.object({
  filename: z.string().min(1).max(255),
  /** Base64-encoded content. */
  content: z.string().min(1),
  contentType: z.string().max(255).optional(),
  /** Set to reference the file inline as `cid:<contentId>`. */
  contentId: z.string().max(255).optional(),
})
export type Attachment = z.infer<typeof Attachment>

const HEADER_NAME = /^[A-Za-z0-9-]{1,76}$/
/** Headers Dak controls; customers cannot override them. */
export const RESERVED_HEADERS = new Set([
  'from',
  'to',
  'cc',
  'bcc',
  'subject',
  'reply-to',
  'date',
  'message-id',
  'mime-version',
  'content-type',
  'content-transfer-encoding',
  'return-path',
  'dkim-signature',
])

export const SendEmailInput = z
  .object({
    from: z.string().min(3).max(320),
    to: Recipients,
    cc: Recipients.optional(),
    bcc: Recipients.optional(),
    replyTo: Recipients.optional(),
    subject: z.string().max(998).optional(),
    html: z.string().optional(),
    text: z.string().optional(),
    template: z
      .object({
        id: z.string().min(1),
        version: z.number().int().positive().optional(),
        variables: z.record(z.string(), z.unknown()).default({}),
      })
      .optional(),
    headers: z.record(z.string(), z.string().max(998)).optional(),
    attachments: z.array(Attachment).max(20).optional(),
    tags: z.record(z.string().max(64), z.string().max(256)).optional(),
    metadata: z.record(z.string().max(64), z.string().max(1024)).optional(),
    stream: Stream.default('transactional'),
    scheduledAt: z.iso.datetime({ offset: true }).optional(),
    /** Absolute expiry; time-sensitive mail (OTPs) is not sent after this. */
    expiresAt: z.iso.datetime({ offset: true }).optional(),
    reference: z.string().max(255).optional(),
  })
  .superRefine((v, ctx) => {
    if (!v.template && !v.html && !v.text) {
      ctx.addIssue({ code: 'custom', path: ['html'], message: 'Provide html, text or a template.' })
    }
    if (!v.template && !v.subject) {
      ctx.addIssue({ code: 'custom', path: ['subject'], message: 'Subject is required.' })
    }
    for (const name of Object.keys(v.headers ?? {})) {
      if (!HEADER_NAME.test(name) || RESERVED_HEADERS.has(name.toLowerCase())) {
        ctx.addIssue({
          code: 'custom',
          path: ['headers', name],
          message: 'This header cannot be set.',
        })
      }
    }
    if (v.scheduledAt && v.expiresAt && Date.parse(v.expiresAt) <= Date.parse(v.scheduledAt)) {
      ctx.addIssue({ code: 'custom', path: ['expiresAt'], message: 'Must be after scheduledAt.' })
    }
  })
export type SendEmailInput = z.input<typeof SendEmailInput>
export type SendEmail = z.output<typeof SendEmailInput>

export const MAX_RECIPIENTS = 50
export const MAX_MESSAGE_BYTES = 10 * 1024 * 1024
export const MAX_SCHEDULE_DAYS = 30
