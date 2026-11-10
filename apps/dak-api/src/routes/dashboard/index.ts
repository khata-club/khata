import { Hono } from 'hono'

import type { AppEnv } from '../../app'
import { can, statements, type Resource } from '../../auth/permissions'
import { requireMember } from '../../middleware/session'
import { audit } from './audit'
import { aws } from './aws'
import { projects } from './projects'
import { support } from './support'
import { workspaces } from './workspaces'

/** Session-authenticated API used by the dashboard (same origin, cookie auth). */
export const dashboard = new Hono<AppEnv>()

dashboard.use('*', requireMember)

/** The signed-in member, active organization and their effective permissions. */
dashboard.get('/me', (c) => {
  const m = c.get('member')!
  const permissions = Object.fromEntries(
    (Object.keys(statements) as Resource[]).map((resource) => [
      resource,
      statements[resource].filter((action) => can(m.role, { [resource]: [action] })),
    ]),
  )
  return c.json({
    user: { id: m.user.id, name: m.user.name, email: m.user.email },
    organizationId: m.tenant.organizationId,
    workspaceId: m.session.activeTeamId ?? null,
    role: m.role,
    permissions,
  })
})

dashboard.route('/workspaces', workspaces)
dashboard.route('/projects', projects)
dashboard.route('/audit', audit)
dashboard.route('/aws-connections', aws)
dashboard.route('/support-grants', support)
