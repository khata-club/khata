import { newId } from '@khata/dak-core'
import type { Context } from 'hono'

import type { AppEnv } from '../app'
import { control } from '../db'

export interface AuditInput {
  action: string
  targetType?: string
  targetId?: string
  data?: Record<string, unknown>
}

/** Who acted: a user, an API key, support staff or the system. */
export function actorOf(c: Context<AppEnv>): string {
  const m = c.get('member')
  if (m) return m.user.id
  const key = c.get('apiKey')
  return key ? `apikey:${key.id}` : 'system'
}

/** Appends an audit record in the caller's tenant. Never contains secrets or bodies. */
export async function audit(c: Context<AppEnv>, input: AuditInput): Promise<void> {
  await c.get('db').control.insert(control.auditEvent, {
    id: newId('auditEvent'),
    actor: actorOf(c),
    action: input.action,
    targetType: input.targetType,
    targetId: input.targetId,
    data: input.data,
    ip: c.req.header('cf-connecting-ip') ?? null,
  })
}
