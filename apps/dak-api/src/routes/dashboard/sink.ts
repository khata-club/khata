import { and, eq } from 'drizzle-orm'
import { Hono } from 'hono'

import type { AppEnv } from '../../app'
import { control, events } from '../../db'
import { HttpError } from '../../lib/errors'
import { requirePermission } from '../../middleware/session'
import type { StoredPayload } from '../../sending/accept'
import { sinkObjectKey } from '../../sending/sink'

/**
 * Mounted at /api/projects/:projectId/sink. Shows what sandbox mail looked like. Sandbox
 * content is test data, so `email:read` suffices; production bodies need `emailBody:read`.
 */
export const sink = new Hono<AppEnv>()

sink.get('/:emailId', requirePermission({ email: ['read'] }), async (c) => {
  const db = c.get('db')
  const email = await db.events.findFirst(
    events.email,
    and(
      eq(events.email.id, c.req.param('emailId')),
      eq(events.email.projectId, c.req.param('projectId')!),
    ),
  )
  const env = email
    ? await db.control.findFirst(
        control.environment,
        eq(control.environment.id, email.environmentId),
      )
    : undefined
  if (!email || env?.kind !== 'sandbox')
    throw new HttpError(404, 'not_found', 'No sandbox email with that ID.')

  if (c.req.query('format') === 'eml') {
    const raw = await c.env.BLOBS.get(sinkObjectKey(email.organizationId, email.id))
    if (!raw) throw new HttpError(404, 'not_found', 'The rendered message is not available yet.')
    return new Response(raw.body, {
      headers: {
        'content-type': 'message/rfc822',
        'content-disposition': `attachment; filename="${email.id}.eml"`,
      },
    })
  }
  const payload = email.payloadKey ? await c.env.BLOBS.get(email.payloadKey) : null
  if (!payload) throw new HttpError(404, 'not_found', 'Content is no longer retained.')
  const p = await payload.json<StoredPayload>()
  return c.json({
    id: email.id,
    from: p.from,
    subject: p.subject,
    html: p.html ?? null,
    text: p.text ?? null,
    headers: p.headers,
    attachments: p.attachments.map((a) => ({
      filename: a.filename,
      contentType: a.contentType,
      inline: !!a.contentId,
    })),
  })
})
