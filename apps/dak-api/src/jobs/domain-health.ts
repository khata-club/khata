import { and, eq, isNull, lt, or } from 'drizzle-orm'

import { control, databases, scoped } from '../db'
import { refreshDomain } from '../domains/service'

const PENDING_EVERY_MS = 10 * 60_000
const VERIFIED_EVERY_MS = 6 * 60 * 60_000
const BATCH = 25

/**
 * Cron: re-check domains (pending ones often, verified ones a few times a day so DNS drift
 * such as a deleted DKIM record is caught). System job: it reads across tenants by design
 * and writes through a scope bound to each row's organization.
 */
export async function runDomainHealth(env: Env, now = Date.now()) {
  const db = databases(env).control
  const d = control.domain
  const due = await db
    .select({ domain: d, project: control.project })
    .from(d)
    .innerJoin(control.project, eq(control.project.id, d.projectId))
    .where(
      and(
        isNull(control.project.archivedAt),
        or(
          isNull(d.lastCheckedAt),
          and(eq(d.status, 'verified'), lt(d.lastCheckedAt, now - VERIFIED_EVERY_MS)),
          and(eq(d.status, 'pending'), lt(d.lastCheckedAt, now - PENDING_EVERY_MS)),
          and(eq(d.status, 'temporary_failure'), lt(d.lastCheckedAt, now - PENDING_EVERY_MS)),
        ),
      ),
    )
    .orderBy(d.lastCheckedAt)
    .limit(BATCH)

  let checked = 0
  for (const row of due) {
    try {
      await refreshDomain(
        env,
        scoped(db, { organizationId: row.domain.organizationId }),
        row.project,
        row.domain,
      )
      checked++
    } catch (err) {
      console.error(
        JSON.stringify({
          level: 'warn',
          msg: 'domain health failed',
          domain: row.domain.id,
          err: String(err),
        }),
      )
    }
  }
  return { due: due.length, checked }
}
