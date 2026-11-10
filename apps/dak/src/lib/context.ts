import { useQuery } from '@tanstack/vue-query'
import { computed, ref, watch } from 'vue'

import { api } from './api'
import { storage } from './storage'

export interface Environment {
  id: string
  name: string
  kind: 'production' | 'staging' | 'sandbox'
  sendingEnabled: boolean
  pausedAt: number | null
  pauseReason: string | null
}

export interface Project {
  id: string
  name: string
  slug: string
  workspaceId: string
  infrastructureMode: 'platform' | 'byo'
  region: string
  retainBodies: boolean
  environments: Environment[]
}

const projectId = ref<string | null>(storage.get('dak.project'))
const environmentId = ref<string | null>(storage.get('dak.environment'))
watch(projectId, (v) => storage.set('dak.project', v))
watch(environmentId, (v) => storage.set('dak.environment', v))

export function useProjects() {
  return useQuery({
    queryKey: ['projects'],
    queryFn: () => api<{ data: Project[] }>('/api/projects').then((r) => r.data),
  })
}

/**
 * The project × environment the dashboard is looking at. Falls back to the first project and
 * its sandbox, so new accounts never start in production.
 */
export function useCurrent() {
  const projects = useProjects()
  const project = computed(
    () =>
      projects.data.value?.find((p) => p.id === projectId.value) ??
      projects.data.value?.[0] ??
      null,
  )
  const environment = computed(() => {
    const envs = project.value?.environments ?? []
    return (
      envs.find((e) => e.id === environmentId.value) ??
      envs.find((e) => e.kind === 'sandbox') ??
      envs[0] ??
      null
    )
  })
  return {
    projects,
    project,
    environment,
    selectProject(id: string) {
      projectId.value = id
      environmentId.value = null
    },
    selectEnvironment(id: string) {
      environmentId.value = id
    },
  }
}
