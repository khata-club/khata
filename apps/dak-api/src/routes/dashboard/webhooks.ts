import {
  generateWebhookSecret,
  newId,
  WEBHOOK_SCHEMA_VERSION,
  WebhookEventType,
} from '@khata/dak-core'
import { and, desc, eq, lt } from 'drizzle-orm'
import { Hono, type Context } from 'hono'
import { z } from 'zod'

import type { AppEnv } from '../../app'
import { control, events } from '../../db'
import { seal } from '../../lib/crypto'
import { HttpError } from '../../lib/errors'
import { validate } from '../../lib/validate'
import { requirePermission } from '../../middleware/session'
import { audit } from '../../services/audit'
import type { WebhookQueueMessage } from '../../webhooks/emit'
import { webhookUrlProblem } from '../../webhooks/url'

/** Mounted at /api/projects/:projectId/webhooks. */
export const webhooks = new Hono<AppEnv>()

const ROTATION_GRACE_MS = 24 * 3600_000

type Endpoint = typeof control.webhookEndpoint.$inferSelect

function present(e: Endpoint) {
  const rest: Partial<Endpoint> = { ...e }
  delete rest.secretEnc
  delete rest.previousSecretEnc
  return {
    ...rest,
    rotating: !!e.previousSecretExpiresAt && e.previousSecretExpiresAt > Date.now(),
  }
}

async function project(c: Context<AppEnv>) {
  const p = await c
    .get('db')
    .control.findFirst(control.project, eq(control.project.id, c.req.param('projectId')!))
  if (!p || p.archivedAt) throw new HttpError(404, 'not_found', 'Project not found.')
  return p
}

async function endpoint(c: Context<AppEnv>) {
  const p = await project(c)
  const e = await c
    .get('db')
    .control.findFirst(
      control.webhookEndpoint,
      and(
        eq(control.webhookEndpoint.id, c.req.param('webhookId')!),
        eq(control.webhookEndpoint.projectId, p.id),
      ),
    )
  if (!e) throw new HttpError(404, 'not_found', 'Webhook endpoint not found.')
  return e
}

const Url = z.string().superRefine((v, ctx) => {
  const problem = webhookUrlProblem(v)
  if (problem) ctx.addIssue({ code: 'custom', message: problem })
})
const EventTypes = z.array(z.union([WebhookEventType, z.literal('*')])).min(1)

webhooks.get('/', requirePermission({ webhook: ['read'] }), async (c) => {
  const p = await project(c)
  const rows = await c
    .get('db')
    .control.findMany(control.webhookEndpoint, eq(control.webhookEndpoint.projectId, p.id), {
      orderBy: desc(control.webhookEndpoint.id),
    })
  return c.json({ data: rows.map(present) })
})

webhooks.post(
  '/',
  requirePermission({ webhook: ['manage'] }),
  validate(
    'json',
    z.object({
      url: Url,
      environmentId: z.string(),
      eventTypes: EventTypes,
      description: z.string().max(300).optional(),
    }),
  ),
  async (c) => {
    const p = await project(c)
    const body = c.req.valid('json')
    const db = c.get('db').control
    const env = await db.findFirst(
      control.environment,
      and(eq(control.environment.id, body.environmentId), eq(control.environment.projectId, p.id)),
    )
    if (!env)
      throw new HttpError(422, 'invalid_environment', 'Environment not found in this project.')
    const id = newId('webhookEndpoint')
    const secret = generateWebhookSecret()
    await db.insert(control.webhookEndpoint, {
      id,
      projectId: p.id,
      environmentId: env.id,
      url: body.url,
      description: body.description ?? null,
      eventTypes: [...new Set(body.eventTypes)],
      secretEnc: await seal(c.env.DAK_DATA_KEY, secret),
    })
    await audit(c, {
      action: 'webhook.created',
      targetType: 'webhook',
      targetId: id,
      data: { url: body.url },
    })
    return c.json({ id, secret }, 201)
  },
)

webhooks.patch(
  '/:webhookId',
  requirePermission({ webhook: ['manage'] }),
  validate(
    'json',
    z.object({
      url: Url.optional(),
      eventTypes: EventTypes.optional(),
      disabled: z.boolean().optional(),
      description: z.string().max(300).optional(),
    }),
  ),
  async (c) => {
    const e = await endpoint(c)
    const body = c.req.valid('json')
    await c.get('db').control.update(
      control.webhookEndpoint,
      {
        ...(body.url && { url: body.url }),
        ...(body.eventTypes && { eventTypes: [...new Set(body.eventTypes)] }),
        ...(body.description !== undefined && { description: body.description }),
        ...(body.disabled !== undefined && { disabledAt: body.disabled ? Date.now() : null }),
      },
      eq(control.webhookEndpoint.id, e.id),
    )
    await audit(c, { action: 'webhook.updated', targetType: 'webhook', targetId: e.id, data: body })
    return c.json({ id: e.id })
  },
)

webhooks.delete('/:webhookId', requirePermission({ webhook: ['manage'] }), async (c) => {
  const e = await endpoint(c)
  await c.get('db').control.delete(control.webhookEndpoint, eq(control.webhookEndpoint.id, e.id))
  await audit(c, { action: 'webhook.deleted', targetType: 'webhook', targetId: e.id })
  return c.body(null, 204)
})

/** New secret, shown once. The old one keeps signing (alongside) for 24 hours. */
webhooks.post('/:webhookId/rotate', requirePermission({ webhook: ['manage'] }), async (c) => {
  const e = await endpoint(c)
  const secret = generateWebhookSecret()
  await c.get('db').control.update(
    control.webhookEndpoint,
    {
      secretEnc: await seal(c.env.DAK_DATA_KEY, secret),
      previousSecretEnc: e.secretEnc,
      previousSecretExpiresAt: Date.now() + ROTATION_GRACE_MS,
    },
    eq(control.webhookEndpoint.id, e.id),
  )
  await audit(c, { action: 'webhook.secret_rotated', targetType: 'webhook', targetId: e.id })
  return c.json({
    id: e.id,
    secret,
    previousValidUntil: new Date(Date.now() + ROTATION_GRACE_MS).toISOString(),
  })
})

webhooks.get(
  '/:webhookId/deliveries',
  requirePermission({ webhook: ['read'] }),
  validate(
    'query',
    z.object({
      before: z.string().optional(),
      limit: z.coerce.number().int().min(1).max(100).default(50),
    }),
  ),
  async (c) => {
    const e = await endpoint(c)
    const { before, limit } = c.req.valid('query')
    const t = events.webhookDelivery
    const rows = await c
      .get('db')
      .events.findMany(t, and(eq(t.endpointId, e.id), before ? lt(t.id, before) : undefined), {
        orderBy: desc(t.id),
        limit: limit + 1,
      })
    return c.json({
      data: rows.slice(0, limit),
      nextCursor: rows.length > limit ? rows[limit - 1]!.id : null,
    })
  },
)

/**
 * Manual replay: re-queues the same payload under the same event ID. It never re-sends the
 * email (acceptance scenario 7).
 */
webhooks.post(
  '/:webhookId/deliveries/:deliveryId/replay',
  requirePermission({ webhook: ['manage'] }),
  async (c) => {
    const e = await endpoint(c)
    const t = events.webhookDelivery
    const db = c.get('db').events
    const d = await db.findFirst(
      t,
      and(eq(t.id, c.req.param('deliveryId')), eq(t.endpointId, e.id)),
    )
    if (!d) throw new HttpError(404, 'not_found', 'Delivery not found.')
    await db.update(t, { status: 'pending', attempts: 0, nextAttemptAt: null }, eq(t.id, d.id))
    await c.env.Q_WEBHOOKS.send({
      deliveryId: d.id,
      organizationId: d.organizationId,
    } satisfies WebhookQueueMessage)
    await audit(c, { action: 'webhook.replayed', targetType: 'webhook_delivery', targetId: d.id })
    return c.json({ id: d.id, eventId: d.eventId, status: 'pending' })
  },
)

/** Sends a `webhook.test` event to check reachability and signature verification. */
webhooks.post('/:webhookId/test', requirePermission({ webhook: ['manage'] }), async (c) => {
  const e = await endpoint(c)
  const id = newId('webhookDelivery')
  const eventId = newId('emailEvent')
  await c.get('db').events.insert(events.webhookDelivery, {
    id,
    endpointId: e.id,
    eventId,
    eventType: 'webhook.test',
    payload: {
      id: eventId,
      type: 'webhook.test',
      schemaVersion: WEBHOOK_SCHEMA_VERSION,
      createdAt: new Date().toISOString(),
      data: { endpointId: e.id },
    },
    status: 'pending',
  })
  await c.env.Q_WEBHOOKS.send({
    deliveryId: id,
    organizationId: e.organizationId,
  } satisfies WebhookQueueMessage)
  return c.json({ id, eventId }, 202)
})
