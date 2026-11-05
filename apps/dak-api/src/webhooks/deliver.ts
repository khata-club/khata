import { MAX_WEBHOOK_ATTEMPTS, webhookBackoffSeconds, webhookHeaders } from '@khata/dak-core'
import { eq } from 'drizzle-orm'

import { control, databases, events, scoped } from '../db'
import { open } from '../lib/crypto'
import type { WebhookQueueMessage } from './emit'

const TIMEOUT_MS = 10_000

export type DeliveryOutcome =
  { action: 'ack'; result: string } | { action: 'retry'; delaySeconds: number; result: string }

/**
 * Delivers one webhook attempt. At least once: consumers dedupe on `webhook-id`. Failures
 * back off exponentially; after MAX_WEBHOOK_ATTEMPTS the delivery is `dead` (kept for
 * inspection and manual replay). Delivering a webhook never touches the email itself.
 */
export async function deliverWebhook(
  env: Env,
  msg: WebhookQueueMessage,
  now = Date.now(),
): Promise<DeliveryOutcome> {
  const dbs = databases(env)
  const tenant = { organizationId: msg.organizationId }
  const ev = scoped(dbs.events, tenant)
  const ctl = scoped(dbs.control, tenant)
  const d = await ev.findFirst(
    events.webhookDelivery,
    eq(events.webhookDelivery.id, msg.deliveryId),
  )
  if (!d || d.status === 'succeeded' || d.status === 'dead')
    return { action: 'ack', result: d ? `already_${d.status}` : 'missing' }
  const endpoint = await ctl.findFirst(
    control.webhookEndpoint,
    eq(control.webhookEndpoint.id, d.endpointId),
  )
  if (!endpoint || endpoint.disabledAt) {
    await ev.update(
      events.webhookDelivery,
      { status: 'failed', lastError: 'endpoint disabled' },
      eq(events.webhookDelivery.id, d.id),
    )
    return { action: 'ack', result: 'endpoint_disabled' }
  }

  const secrets = [await open(env.DAK_DATA_KEY, endpoint.secretEnc)]
  if (endpoint.previousSecretEnc && (endpoint.previousSecretExpiresAt ?? 0) > now) {
    secrets.push(await open(env.DAK_DATA_KEY, endpoint.previousSecretEnc))
  }
  const body = JSON.stringify(d.payload)
  const started = Date.now()
  let status = 0
  let error: string | null = null
  try {
    const res = await fetch(endpoint.url, {
      method: 'POST',
      redirect: 'manual',
      headers: {
        'content-type': 'application/json',
        'user-agent': 'Dak-Webhooks/1.0',
        ...(await webhookHeaders(secrets, d.eventId, body, now)),
      },
      body,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
    status = res.status
    await res.body?.cancel()
  } catch (err) {
    error = err instanceof Error ? `${err.name}: ${err.message}`.slice(0, 300) : String(err)
  }
  const latency = Date.now() - started
  const attempts = d.attempts + 1

  if (status >= 200 && status < 300) {
    await ev.update(
      events.webhookDelivery,
      {
        status: 'succeeded',
        attempts,
        lastStatusCode: status,
        lastError: null,
        lastLatencyMs: latency,
        deliveredAt: now,
        nextAttemptAt: null,
      },
      eq(events.webhookDelivery.id, d.id),
    )
    return { action: 'ack', result: 'delivered' }
  }
  const dead = attempts >= MAX_WEBHOOK_ATTEMPTS
  const delay = webhookBackoffSeconds(attempts)
  await ev.update(
    events.webhookDelivery,
    {
      status: dead ? 'dead' : 'failed',
      attempts,
      lastStatusCode: status || null,
      lastError: error ?? `HTTP ${status}`,
      lastLatencyMs: latency,
      nextAttemptAt: dead ? null : now + delay * 1000,
    },
    eq(events.webhookDelivery.id, d.id),
  )
  return dead
    ? { action: 'ack', result: 'dead' }
    : { action: 'retry', delaySeconds: delay, result: 'failed' }
}
