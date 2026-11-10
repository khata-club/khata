import { and, eq, gte, inArray, isNotNull, isNull, lte } from 'drizzle-orm'
import { Hono } from 'hono'
import { z } from 'zod'

import type { AppEnv } from '../../app'
import { events } from '../../db'
import { validate } from '../../lib/validate'
import { requirePermission } from '../../middleware/session'
import { summarize } from '../../observability/metrics'

/**
 * Mounted at /api/projects/:projectId/monitoring. Stage latencies, throughput, failures,
 * queue age and throttling for an environment over a window, computed from the delivery
 * database (bounded samples). Analytics Engine carries the same stages for long ranges.
 */
export const monitoring = new Hono<AppEnv>()

const SAMPLE = 5000

monitoring.get(
  '/',
  requirePermission({ analytics: ['read'] }),
  validate(
    'query',
    z.object({
      environmentId: z.string(),
      hours: z.coerce
        .number()
        .int()
        .min(1)
        .max(24 * 14)
        .default(24),
    }),
  ),
  async (c) => {
    const projectId = c.req.param('projectId')!
    const { environmentId, hours } = c.req.valid('query')
    const now = Date.now()
    const since = now - hours * 3600_000
    const db = c.get('db').events
    const e = events.email

    const emails = await db.findMany(
      e,
      and(eq(e.projectId, projectId), eq(e.environmentId, environmentId), gte(e.acceptedAt, since)),
      { limit: SAMPLE },
    )
    const ids = emails.map((m) => m.id)
    const chunk = <T>(xs: T[], n = 90) =>
      Array.from({ length: Math.ceil(xs.length / n) }, (_, i) => xs.slice(i * n, i * n + n))
    const inIds = async <R>(fn: (part: string[]) => Promise<R[]>) =>
      (await Promise.all(chunk(ids).map(fn))).flat()

    const [attempts, started, recipients, hooks, provEvents] = ids.length
      ? await Promise.all([
          inIds((p) => db.findMany(events.sendAttempt, inArray(events.sendAttempt.emailId, p))),
          inIds((p) =>
            db.findMany(
              events.emailEvent,
              and(
                inArray(events.emailEvent.emailId, p),
                eq(events.emailEvent.type, 'dispatch_started'),
              ),
            ),
          ),
          inIds((p) =>
            db.findMany(events.emailRecipient, inArray(events.emailRecipient.emailId, p)),
          ),
          inIds((p) =>
            db.findMany(
              events.webhookDelivery,
              and(
                inArray(events.webhookDelivery.emailId, p),
                isNotNull(events.webhookDelivery.lastLatencyMs),
              ),
            ),
          ),
          inIds((p) =>
            db.findMany(
              events.emailEvent,
              and(
                inArray(events.emailEvent.emailId, p),
                inArray(events.emailEvent.type, [
                  'delivery',
                  'bounce',
                  'complaint',
                  'delivery_delay',
                  'open',
                  'click',
                ]),
              ),
            ),
          ),
        ])
      : [[], [], [], [], []]

    const queued = await db.findMany(
      e,
      and(
        eq(e.projectId, projectId),
        eq(e.environmentId, environmentId),
        inArray(e.status, ['queued', 'accepted']),
        isNull(e.cancelledAt),
        lte(e.acceptedAt, now),
      ),
      { orderBy: e.acceptedAt, limit: 1 },
    )

    // Throughput per hour bucket (oldest first).
    const buckets = Array.from(
      { length: Math.min(hours, 48) },
      (_, i) => now - (Math.min(hours, 48) - 1 - i) * 3600_000,
    )
    const perHour = buckets.map(
      (b) => emails.filter((m) => m.acceptedAt > b - 3600_000 && m.acceptedAt <= b).length,
    )
    const statusCount = (s: string) => recipients.filter((r) => r.deliveryStatus === s).length
    const submittedRecipients = recipients.filter((r) => r.submittedAt).length

    return c.json({
      window: { hours, since, until: now, sampled: emails.length >= SAMPLE },
      throughput: {
        accepted: emails.length,
        perHour,
        hours: buckets.map((b) => new Date(b).toISOString()),
      },
      stages: {
        queue: summarize(started.map((s) => (s.data as { queueWaitMs?: number }).queueWaitMs ?? 0)),
        provider: summarize(attempts.map((a) => a.latencyMs)),
        delivery: summarize(
          recipients
            .filter((r) => r.deliveredAt && r.submittedAt)
            .map((r) => r.deliveredAt! - r.submittedAt!),
        ),
        eventIngest: summarize(
          provEvents
            .filter((x) => x.providerAt)
            .map((x) => Math.max(0, x.ingestedAt - x.providerAt!)),
        ),
        webhook: summarize(hooks.map((h) => h.lastLatencyMs!)),
      },
      outcomes: {
        submitted: submittedRecipients,
        delivered: statusCount('delivered'),
        bounced: statusCount('bounced'),
        complained: statusCount('complained'),
        rejected: statusCount('rejected'),
        uncertain: statusCount('submission_uncertain'),
        suppressed: statusCount('suppressed'),
        pending: statusCount('pending') + statusCount('submitted') + statusCount('delayed'),
      },
      provider: {
        throttled: attempts.filter((a) => a.outcome === 'throttled').length,
        failed: attempts.filter((a) => a.outcome === 'failed' || a.outcome === 'uncertain').length,
      },
      queueAgeMs: queued[0] ? now - queued[0].acceptedAt : 0,
      webhooks: {
        succeeded: hooks.filter((h) => h.status === 'succeeded').length,
        failing: hooks.filter((h) => h.status === 'failed' || h.status === 'dead').length,
      },
    })
  },
)
