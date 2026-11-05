import { ref } from 'vue'

import { api, ApiError } from './api'

export interface Me {
  user: { id: string; name: string; email: string }
  organizationId: string
  workspaceId: string | null
  role: string
  permissions: Record<string, string[]>
}

/** Cached `/api/me`. `undefined` = not loaded; `null` = signed out or no organization. */
export const me = ref<Me | null | undefined>(undefined)
export const meError = ref<string>()

export async function loadMe(force = false): Promise<Me | null> {
  // Only a signed-in result is cached; failures are retried on the next navigation.
  if (me.value && !force) return me.value
  try {
    me.value = await api<Me>('/api/me')
    meError.value = undefined
  } catch (err) {
    me.value = null
    meError.value = err instanceof ApiError ? err.code : 'network_error'
  }
  return me.value
}

export function hasPermission(resource: string, action: string): boolean {
  return me.value?.permissions[resource]?.includes(action) ?? false
}
