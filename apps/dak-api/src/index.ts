import { app } from './app'
import { runDomainHealth } from './jobs/domain-health'
import { queueKind } from './queues'

export { SendGate } from './durable/SendGate'

export default {
  fetch: app.fetch,

  async queue(batch) {
    const kind = queueKind(batch.queue)
    if (!kind) throw new Error(`Unknown queue: ${batch.queue}`)
    // Consumers land in Dak 12/22 (dispatch), 13/22 (events) and 17/22 (webhooks). Until then
    // retry so nothing is acknowledged without being processed.
    batch.retryAll({ delaySeconds: 60 })
  },

  async scheduled(controller, env, ctx) {
    switch (controller.cron) {
      case '*/15 * * * *':
        ctx.waitUntil(runDomainHealth(env))
        break
      default:
        // Outbox sweep and retention purge are wired in later PRs.
        console.log(JSON.stringify({ level: 'info', msg: 'cron', cron: controller.cron }))
    }
  },
} satisfies ExportedHandler<Env>
