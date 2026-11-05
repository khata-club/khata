import { describe, expect, it } from 'vitest'

import {
  generateWebhookSecret,
  verifyWebhook,
  webhookBackoffSeconds,
  webhookHeaders,
  WebhookVerificationError,
} from './webhooks.ts'

describe('webhook signing', () => {
  const body = JSON.stringify({ id: 'evt_1', type: 'email.delivered', data: {} })

  it('round-trips and rejects tampering', async () => {
    const secret = generateWebhookSecret()
    const h = await webhookHeaders([secret], 'evt_1', body)
    await expect(verifyWebhook(secret, body, h)).resolves.toMatchObject({ id: 'evt_1' })
    await expect(verifyWebhook(secret, body.replace('delivered', 'bounced'), h)).rejects.toThrow(
      WebhookVerificationError,
    )
    await expect(verifyWebhook(generateWebhookSecret(), body, h)).rejects.toThrow(
      WebhookVerificationError,
    )
  })

  it('accepts either secret during rotation', async () => {
    const [oldS, newS] = [generateWebhookSecret(), generateWebhookSecret()]
    const h = await webhookHeaders([newS, oldS], 'evt_2', body)
    expect(h['webhook-signature'].split(' ')).toHaveLength(2)
    await expect(verifyWebhook(oldS, body, h)).resolves.toBeTruthy()
    await expect(verifyWebhook(newS, body, h)).resolves.toBeTruthy()
  })

  it('enforces the timestamp tolerance', async () => {
    const s = generateWebhookSecret()
    const h = await webhookHeaders([s], 'evt_3', body, Date.now() - 10 * 60_000)
    await expect(verifyWebhook(s, body, h)).rejects.toThrow(/tolerance/)
  })

  it('backs off exponentially with a cap', () => {
    expect([1, 2, 3, 20].map(webhookBackoffSeconds)).toEqual([30, 60, 120, 21600])
  })
})
