import { and, eq, ne } from 'drizzle-orm'
import { Hono } from 'hono'

import type { AppEnv } from '../app'
import { control, databases } from '../db'
import type { EventQueueMessage, SesEvent } from './ses-events'
import { isSnsUrl, verifySnsMessage, type SnsMessage } from './sns'

/** SNS → HTTPS endpoint for SES events. Unauthenticated by design; every message is signed. */
export const ingest = new Hono<AppEnv>()

const REQUIRED = [
  'Type',
  'MessageId',
  'TopicArn',
  'Message',
  'Timestamp',
  'Signature',
  'SigningCertURL',
  'SignatureVersion',
]

async function topicAllowed(env: Env, topicArn: string): Promise<boolean> {
  if (
    (env.DAK_SNS_TOPIC_ARNS ?? '')
      .split(',')
      .map((s) => s.trim())
      .includes(topicArn)
  )
    return true
  const account = /^arn:aws[a-z-]*:sns:[a-z0-9-]+:(\d{12}):/.exec(topicArn)?.[1]
  if (!account) return false
  const [conn] = await databases(env)
    .control.select({ id: control.awsConnection.id })
    .from(control.awsConnection)
    .where(
      and(
        eq(control.awsConnection.accountId, account),
        ne(control.awsConnection.status, 'disconnected'),
      ),
    )
    .limit(1)
  return !!conn
}

ingest.post('/ses', async (c) => {
  let m: SnsMessage
  try {
    m = JSON.parse(await c.req.text()) as SnsMessage
  } catch {
    return c.json({ error: { code: 'invalid_message', message: 'Body is not JSON.' } }, 400)
  }
  if (REQUIRED.some((k) => typeof (m as unknown as Record<string, unknown>)[k] !== 'string')) {
    return c.json({ error: { code: 'invalid_message', message: 'Not an SNS message.' } }, 400)
  }
  if (!(await verifySnsMessage(m))) {
    return c.json(
      { error: { code: 'invalid_signature', message: 'SNS signature verification failed.' } },
      403,
    )
  }
  if (!(await topicAllowed(c.env, m.TopicArn))) {
    return c.json(
      { error: { code: 'unknown_topic', message: 'This topic is not registered with Dak.' } },
      403,
    )
  }

  if (m.Type === 'SubscriptionConfirmation') {
    if (!isSnsUrl(m.SubscribeURL, /^\/$/)) {
      return c.json({ error: { code: 'invalid_message', message: 'Bad SubscribeURL.' } }, 400)
    }
    const res = await fetch(m.SubscribeURL!)
    return c.json({ confirmed: res.ok }, res.ok ? 200 : 502)
  }
  if (m.Type !== 'Notification') return c.json({ ok: true })

  let event: SesEvent
  try {
    event = JSON.parse(m.Message) as SesEvent
  } catch {
    return c.json({ ok: true, ignored: 'not_json' })
  }
  // Raw evidence first (spec §13: keep provider and ingestion timestamps), then fast hand-off.
  const day = new Date().toISOString().slice(0, 10).replace(/-/g, '/')
  c.executionCtx.waitUntil(
    c.env.BLOBS.put(`events/raw/${day}/${m.MessageId}.json`, JSON.stringify(m), {
      httpMetadata: { contentType: 'application/json' },
    }),
  )
  const msg: EventQueueMessage = { snsMessageId: m.MessageId, topicArn: m.TopicArn, event }
  await c.env.Q_EVENTS.send(msg, { contentType: 'json' })
  return c.json({ ok: true })
})
