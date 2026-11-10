import { runDomainHealth } from './jobs/domain-health'
import { sweepOutbox } from './jobs/outbox-sweep'
import { isStreamQueue, queueKind } from './queues'
import { app } from './app'
import { processSesEvent, type EventQueueMessage } from './ingest/ses-events'
import { dispatchEmail } from './sending/dispatch'
import type { DispatchMessage } from './sending/queue'

export { SendGate } from './durable/SendGate'

const DISPATCH_CONCURRENCY = 8

export default {
  fetch: app.fetch,

  async queue(batch, env) {
    const kind = queueKind(batch.queue)
    if (!kind) throw new Error(`Unknown queue: ${batch.queue}`)
    if (kind === 'events') {
      for (const m of batch.messages as readonly Message<EventQueueMessage>[]) {
        try {
          await processSesEvent(env, m.body)
          m.ack()
        } catch (err) {
          console.error(
            JSON.stringify({
              level: 'error',
              msg: 'event failed',
              id: m.body.snsMessageId,
              err: String(err),
            }),
          )
          m.retry({ delaySeconds: Math.min(600, 15 * m.attempts) })
        }
      }
      return
    }
    if (!isStreamQueue(kind)) {
      // The webhooks consumer lands in Dak 17/22.
      batch.retryAll({ delaySeconds: 60 })
      return
    }
    const messages = [...batch.messages] as Message<DispatchMessage>[]
    for (let i = 0; i < messages.length; i += DISPATCH_CONCURRENCY) {
      await Promise.all(
        messages.slice(i, i + DISPATCH_CONCURRENCY).map(async (m) => {
          try {
            const out = await dispatchEmail(env, m.body)
            if (out.action === 'ack') m.ack()
            else m.retry({ delaySeconds: out.delaySeconds })
          } catch (err) {
            console.error(
              JSON.stringify({
                level: 'error',
                msg: 'dispatch crashed',
                emailId: m.body.emailId,
                err: String(err),
              }),
            )
            m.retry({ delaySeconds: Math.min(600, 30 * m.attempts) })
          }
        }),
      )
    }
  },

  async scheduled(controller, env, ctx) {
    switch (controller.cron) {
      case '* * * * *':
        ctx.waitUntil(sweepOutbox(env))
        break
      case '*/15 * * * *':
        ctx.waitUntil(runDomainHealth(env))
        break
      default:
        console.log(JSON.stringify({ level: 'info', msg: 'cron', cron: controller.cron }))
    }
  },
} satisfies ExportedHandler<Env>
