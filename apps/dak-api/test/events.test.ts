import { env, exports } from 'cloudflare:workers'
import { afterEach, describe, expect, it } from 'vitest'

import { processSesEvent, type SesEvent } from '../src/ingest/ses-events'
import {
  clearSnsKeyCache,
  pemToDer,
  spkiFromCertificate,
  stringToSign,
  type SnsMessage,
} from '../src/ingest/sns'
import { dispatchEmail } from '../src/sending/dispatch'
import { mockAws } from './aws-mock'
import { productionSender, sampleEmail, withProject } from './helpers'
import { REAL_CERT_PEM, REAL_CERT_SPKI_B64 } from './sns-fixture'

const TOPIC = 'arn:aws:sns:eu-west-1:111111111111:dak-dev-events'
const CERT_URL = 'https://sns.eu-west-1.amazonaws.com/SimpleNotificationService-test.pem'

let restore: (() => void) | undefined
afterEach(() => {
  restore?.()
  clearSnsKeyCache()
})

// --- A signing key and a minimal certificate-shaped DER around its public key -------------
function derLen(n: number): number[] {
  if (n < 0x80) return [n]
  const bytes: number[] = []
  while (n > 0) {
    bytes.unshift(n & 0xff)
    n >>= 8
  }
  return [0x80 | bytes.length, ...bytes]
}
const der = (tag: number, ...parts: number[][]) => {
  const body = parts.flat()
  return [tag, ...derLen(body.length), ...body]
}
const seq = (...p: number[][]) => der(0x30, ...p)

async function signer() {
  const keys = (await crypto.subtle.generateKey(
    {
      name: 'RSASSA-PKCS1-v1_5',
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: 'SHA-256',
    },
    true,
    ['sign', 'verify'],
  )) as CryptoKeyPair
  const spki = [
    ...new Uint8Array((await crypto.subtle.exportKey('spki', keys.publicKey)) as ArrayBuffer),
  ]
  const empty = seq()
  const tbs = seq(der(0xa0, der(0x02, [2])), der(0x02, [1]), empty, empty, empty, empty, spki)
  const cert = seq(tbs, empty, der(0x03, [0]))
  const pem = `-----BEGIN CERTIFICATE-----\n${btoa(String.fromCharCode(...cert))}\n-----END CERTIFICATE-----`
  const sha1 = await crypto.subtle.importKey(
    'pkcs8',
    await crypto.subtle.exportKey('pkcs8', keys.privateKey),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-1' },
    false,
    ['sign'],
  )
  return {
    pem,
    async sign(m: Omit<SnsMessage, 'Signature'>, version: '1' | '2' = '2') {
      const msg = { ...m, SignatureVersion: version } as SnsMessage
      const key = version === '2' ? keys.privateKey : sha1
      const sig = await crypto.subtle.sign(
        'RSASSA-PKCS1-v1_5',
        key,
        new TextEncoder().encode(stringToSign(msg)),
      )
      return { ...msg, Signature: btoa(String.fromCharCode(...new Uint8Array(sig))) }
    },
  }
}

function serveCert(pem: string) {
  const m = mockAws({
    handle: (url) => (url.pathname.endsWith('.pem') ? new Response(pem) : undefined),
  })
  restore = m.restore
  return m.state
}

const post = (body: unknown) =>
  exports.default.fetch('https://api.test/ingest/ses', {
    method: 'POST',
    headers: { 'content-type': 'text/plain; charset=UTF-8' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  })

function notification(event: Partial<SesEvent> & { eventType: string }, id = crypto.randomUUID()) {
  return {
    Type: 'Notification' as const,
    MessageId: id,
    TopicArn: TOPIC,
    Message: JSON.stringify(event),
    Timestamp: new Date().toISOString(),
    SignatureVersion: '2' as const,
    SigningCertURL: CERT_URL,
  }
}

describe('SNS verification', () => {
  it('extracts SubjectPublicKeyInfo from a real X.509 certificate', () => {
    const spki = spkiFromCertificate(pemToDer(REAL_CERT_PEM))
    expect(btoa(String.fromCharCode(...spki))).toBe(REAL_CERT_SPKI_B64)
  })

  it('accepts signed notifications (v1 and v2) and rejects tampering', async () => {
    const s = await signer()
    serveCert(s.pem)
    const evt = {
      eventType: 'Delivery',
      mail: { messageId: 'x', timestamp: new Date().toISOString(), destination: ['a@b.c'] },
    }
    expect((await post(await s.sign(notification(evt), '2'))).status).toBe(200)
    expect((await post(await s.sign(notification(evt), '1'))).status).toBe(200)

    const signed = await s.sign(notification(evt))
    expect(
      (await post({ ...signed, Message: signed.Message.replace('Delivery', 'Bounce') })).status,
    ).toBe(403)
  })

  it('rejects certificates from non-SNS hosts and unknown topics', async () => {
    const s = await signer()
    serveCert(s.pem)
    const evt = {
      eventType: 'Send',
      mail: { messageId: 'x', timestamp: new Date().toISOString(), destination: [] },
    }
    const foreignCert = await s.sign({
      ...notification(evt),
      SigningCertURL: 'https://evil.example.com/SimpleNotificationService-x.pem',
    })
    expect((await post(foreignCert)).status).toBe(403)
    const foreignTopic = await s.sign({
      ...notification(evt),
      TopicArn: 'arn:aws:sns:eu-west-1:999999999999:other',
    })
    expect((await post(foreignTopic)).status).toBe(403)
    expect((await post('not json')).status).toBe(400)
  })

  it('confirms subscriptions only via SNS URLs', async () => {
    const s = await signer()
    const aws = serveCert(s.pem)
    aws.handle = (url) =>
      url.pathname.endsWith('.pem')
        ? new Response(s.pem)
        : url.searchParams.get('Action') === 'ConfirmSubscription'
          ? new Response('<ok/>')
          : undefined
    const confirm = await s.sign({
      Type: 'SubscriptionConfirmation',
      MessageId: 'm1',
      TopicArn: TOPIC,
      Message: 'confirm',
      Timestamp: new Date().toISOString(),
      SignatureVersion: '2',
      SigningCertURL: CERT_URL,
      SubscribeURL: 'https://sns.eu-west-1.amazonaws.com/?Action=ConfirmSubscription&Token=t',
      Token: 't',
    })
    const res = await post(confirm)
    expect(await res.json()).toEqual({ confirmed: true })
    expect(aws.calls.some((c) => c.url.includes('ConfirmSubscription'))).toBe(true)
  })
})

describe('processing SES events', () => {
  async function submitted(over: Record<string, unknown> = {}) {
    const m = mockAws({
      handle: (url) =>
        url.pathname.endsWith('/outbound-emails')
          ? Response.json({ MessageId: 'ses-msg-1' })
          : undefined,
    })
    restore = m.restore
    const ctx = await withProject()
    const api = await productionSender(ctx)
    const res = await api.call<{ id: string }>('POST', '/v1/emails', sampleEmail(over))
    await dispatchEmail(env, {
      emailId: res.body.id,
      organizationId: ctx.organizationId,
      stream: 'transactional',
    })
    return { ...ctx, ...api, emailId: res.body.id }
  }

  const mail = (emailId: string, org: string, destination = ['ada@example.com']) => ({
    messageId: 'ses-msg-1',
    timestamp: '2026-11-05T10:00:00.000Z',
    destination,
    tags: { dak_email_id: [emailId], dak_org: [org] },
  })
  const status = async (emailId: string, address = 'ada@example.com') =>
    env.DB_EVENTS.prepare(
      'SELECT delivery_status AS s, open_count AS o, delivered_at AS d FROM email_recipient WHERE email_id = ? AND address = ?',
    )
      .bind(emailId, address)
      .first<{ s: string; o: number; d: number | null }>()
  const apply = (event: SesEvent, id = crypto.randomUUID()) =>
    processSesEvent(env, { snsMessageId: id, topicArn: TOPIC, event })

  it('marks delivery and ignores duplicate and late events (scenario 3)', async () => {
    const s = await submitted()
    const delivery: SesEvent = {
      eventType: 'Delivery',
      mail: mail(s.emailId, s.organizationId),
      delivery: {
        timestamp: '2026-11-05T10:00:03.000Z',
        recipients: ['Ada@Example.com'],
        smtpResponse: '250 OK',
      },
    }
    expect((await apply(delivery, 'sns-1')).applied).toBe(1)
    expect((await apply(delivery, 'sns-1')).applied).toBe(0)
    await apply({
      eventType: 'DeliveryDelay',
      mail: mail(s.emailId, s.organizationId),
      deliveryDelay: {
        timestamp: '2026-11-05T10:00:01.000Z',
        delayedRecipients: [{ emailAddress: 'ada@example.com' }],
      },
    })
    expect(await status(s.emailId)).toMatchObject({
      s: 'delivered',
      d: Date.parse('2026-11-05T10:00:03.000Z'),
    })
    const events = await env.DB_EVENTS.prepare(
      "SELECT count(*) AS n FROM email_event WHERE email_id = ? AND type = 'delivery'",
    )
      .bind(s.emailId)
      .first()
    expect(events).toEqual({ n: 1 })
  })

  it('counts engagement without overwriting a bounce', async () => {
    const s = await submitted()
    await apply({
      eventType: 'Bounce',
      mail: mail(s.emailId, s.organizationId),
      bounce: {
        bounceType: 'Permanent',
        timestamp: '2026-11-05T10:00:02.000Z',
        bouncedRecipients: [
          { emailAddress: 'ada@example.com', diagnosticCode: '550 5.1.1 user unknown' },
        ],
      },
    })
    await apply({
      eventType: 'Open',
      mail: mail(s.emailId, s.organizationId),
      open: { timestamp: '2026-11-05T10:05:00.000Z' },
    })
    expect(await status(s.emailId)).toMatchObject({ s: 'bounced', o: 1 })
  })

  it('suppresses on complaint, blocking the next send (scenario 4)', async () => {
    const s = await submitted()
    await apply({
      eventType: 'Complaint',
      mail: mail(s.emailId, s.organizationId),
      complaint: {
        timestamp: '2026-11-05T11:00:00.000Z',
        complainedRecipients: [{ emailAddress: 'ada@example.com' }],
      },
    })
    expect((await status(s.emailId))!.s).toBe('complained')
    const next = await s.call<{ status: string }>(
      'POST',
      '/v1/emails',
      sampleEmail({ stream: 'authentication' }),
    )
    expect(next.body.status).toBe('suppressed')
  })

  it('suppresses after repeated soft bounces, with expiry', async () => {
    const s = await submitted()
    for (let i = 0; i < 3; i++) {
      const res = await s.call<{ id: string }>('POST', '/v1/emails', sampleEmail())
      await dispatchEmail(env, {
        emailId: res.body.id,
        organizationId: s.organizationId,
        stream: 'transactional',
      })
      await apply({
        eventType: 'Bounce',
        mail: mail(res.body.id, s.organizationId),
        bounce: {
          bounceType: 'Transient',
          timestamp: new Date(Date.now() - (3 - i) * 1000).toISOString(),
          bouncedRecipients: [{ emailAddress: 'ada@example.com' }],
        },
      })
    }
    const sup = await env.DB.prepare(
      "SELECT reason, expires_at FROM suppression WHERE project_id = ? AND email = 'ada@example.com'",
    )
      .bind(s.projectId)
      .first<{ reason: string; expires_at: number }>()
    expect(sup?.reason).toBe('soft_bounce_policy')
    expect(sup!.expires_at).toBeGreaterThan(Date.now())
  })

  it('reconciles submission-uncertain recipients from tagged events', async () => {
    const m = mockAws({
      handle: (url) => {
        if (url.pathname.endsWith('/outbound-emails'))
          throw new DOMException('timeout', 'TimeoutError')
        return undefined
      },
    })
    restore = m.restore
    const ctx = await withProject()
    const api = await productionSender(ctx)
    const res = await api.call<{ id: string }>('POST', '/v1/emails', sampleEmail())
    await dispatchEmail(env, {
      emailId: res.body.id,
      organizationId: ctx.organizationId,
      stream: 'transactional',
    })
    expect((await status(res.body.id))!.s).toBe('submission_uncertain')
    await apply({
      eventType: 'Send',
      mail: { ...mail(res.body.id, ctx.organizationId), messageId: 'late-ses-id' },
    })
    const row = await env.DB_EVENTS.prepare(
      'SELECT delivery_status AS s, provider_message_id AS p FROM email_recipient WHERE email_id = ?',
    )
      .bind(res.body.id)
      .first()
    expect(row).toEqual({ s: 'submitted', p: 'late-ses-id' })
  })

  it('ignores events from a customer topic for another organization', async () => {
    const s = await submitted()
    const r = await processSesEvent(env, {
      snsMessageId: 'x',
      topicArn: 'arn:aws:sns:eu-west-1:210987654321:dak-awc-events',
      event: {
        eventType: 'Delivery',
        mail: mail(s.emailId, s.organizationId),
        delivery: { timestamp: new Date().toISOString(), recipients: ['ada@example.com'] },
      },
    })
    expect(r.reason).toBe('foreign_topic')
  })
})
