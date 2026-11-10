import { createMiddleware } from 'hono/factory'

import { createAuth, type Session } from '../auth'
import { can, type Permission } from '../auth/permissions'
import type { AppEnv } from '../app'
import { databases, scoped, type Tenant } from '../db'
import { HttpError } from '../lib/errors'

export interface MemberContext {
  user: Session['user']
  session: Session['session']
  tenant: Tenant
  /** Comma-separated Better Auth roles of the member in the active organization. */
  role: string
}

/** Requires a signed-in user with an active organization they belong to. */
export const requireMember = createMiddleware<AppEnv>(async (c, next) => {
  const auth = createAuth(c.env)
  const result = await auth.api.getSession({ headers: c.req.raw.headers })
  if (!result) throw new HttpError(401, 'unauthenticated', 'Sign in to continue.')

  const organizationId = result.session.activeOrganizationId
  if (!organizationId) throw new HttpError(409, 'no_active_organization', 'Choose an organization.')

  const db = databases(c.env)
  const member = await db.control.query.member.findFirst({
    where: (m, { and, eq }) =>
      and(eq(m.organizationId, organizationId), eq(m.userId, result.user.id)),
  })
  if (!member)
    throw new HttpError(403, 'not_a_member', 'You are not a member of this organization.')

  c.set('member', {
    user: result.user,
    session: result.session,
    tenant: { organizationId },
    role: member.role,
  })
  c.set('db', {
    control: scoped(db.control, { organizationId }),
    events: scoped(db.events, { organizationId }),
  })
  await next()
})

/** Route guard for spec §4 permissions. Use after `requireMember`. */
export function requirePermission(permission: Permission) {
  return createMiddleware<AppEnv>(async (c, next) => {
    const member = c.get('member')
    if (!member || !can(member.role, permission)) {
      throw new HttpError(403, 'forbidden', 'Your role does not allow this action.')
    }
    await next()
  })
}
