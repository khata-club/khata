/**
 * Spec §4 roles as Better Auth access-control statements. The same definitions guard the
 * dashboard API (Dak 6/22) and drive what the dashboard shows.
 */
import { createAccessControl } from 'better-auth/plugins/access'
import { defaultStatements } from 'better-auth/plugins/organization/access'

export const statements = {
  ...defaultStatements,
  billing: ['read', 'manage'],
  workspace: ['create', 'update', 'delete'],
  project: ['create', 'read', 'update', 'delete'],
  infrastructure: ['read', 'manage'],
  domain: ['read', 'manage'],
  apiKey: ['read', 'manage'],
  template: ['read', 'write', 'publish'],
  email: ['read', 'send'],
  /** Distinct from `email:read`: rendered bodies and attachments (spec §4). */
  emailBody: ['read'],
  webhook: ['read', 'manage'],
  analytics: ['read'],
  contact: ['read', 'write'],
  campaign: ['read', 'write', 'approve'],
  audit: ['read'],
  support: ['grant'],
} as const

export const ac = createAccessControl(statements)

const read = {
  project: ['read'],
  infrastructure: ['read'],
  domain: ['read'],
  template: ['read'],
  email: ['read'],
  webhook: ['read'],
  analytics: ['read'],
} as const

export const roles = {
  owner: ac.newRole({
    organization: ['update', 'delete'],
    member: ['create', 'update', 'delete'],
    invitation: ['create', 'cancel'],
    team: ['create', 'update', 'delete'],
    ac: ['create', 'read', 'update', 'delete'],
    billing: ['read', 'manage'],
    workspace: ['create', 'update', 'delete'],
    project: ['create', 'read', 'update', 'delete'],
    infrastructure: ['read', 'manage'],
    domain: ['read', 'manage'],
    apiKey: ['read', 'manage'],
    template: ['read', 'write', 'publish'],
    email: ['read', 'send'],
    emailBody: ['read'],
    webhook: ['read', 'manage'],
    analytics: ['read'],
    contact: ['read', 'write'],
    campaign: ['read', 'write', 'approve'],
    audit: ['read'],
    support: ['grant'],
  }),
  admin: ac.newRole({
    organization: ['update'],
    member: ['create', 'update', 'delete'],
    invitation: ['create', 'cancel'],
    team: ['create', 'update', 'delete'],
    workspace: ['create', 'update', 'delete'],
    project: ['create', 'read', 'update', 'delete'],
    infrastructure: ['read', 'manage'],
    domain: ['read', 'manage'],
    apiKey: ['read', 'manage'],
    template: ['read', 'write', 'publish'],
    email: ['read', 'send'],
    webhook: ['read', 'manage'],
    analytics: ['read'],
    contact: ['read', 'write'],
    campaign: ['read', 'write', 'approve'],
    audit: ['read'],
    support: ['grant'],
  }),
  developer: ac.newRole({
    ...read,
    apiKey: ['read', 'manage'],
    template: ['read', 'write', 'publish'],
    email: ['read', 'send'],
    webhook: ['read', 'manage'],
  }),
  marketer: ac.newRole({
    ...read,
    template: ['read', 'write', 'publish'],
    contact: ['read', 'write'],
    campaign: ['read', 'write'],
  }),
  analyst: ac.newRole({ ...read }),
  billing: ac.newRole({ billing: ['read', 'manage'] }),
}

export type RoleName = keyof typeof roles
export type Resource = keyof typeof statements
export type Permission = { [R in Resource]?: (typeof statements)[R][number][] }

/** True when every requested action is granted by at least one of the member's roles. */
export function can(roleList: string, permission: Permission): boolean {
  const memberRoles = roleList
    .split(',')
    .map((r) => roles[r.trim() as RoleName])
    .filter((r) => r !== undefined)
  if (memberRoles.length === 0) return false
  return Object.entries(permission).every(([resource, actions]) =>
    (actions as string[]).every((action) =>
      memberRoles.some((role) => role.authorize({ [resource]: [action] } as never).success),
    ),
  )
}
