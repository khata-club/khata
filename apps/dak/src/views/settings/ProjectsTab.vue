<script setup lang="ts">
import { useQuery, useQueryClient } from '@tanstack/vue-query'
import {
  KButton,
  KDialog,
  KEmptyState,
  KSelect,
  KStatusPill,
  KSwitch,
  KTextField,
  useToast,
} from '@khata/ui'
import { FolderPlus } from '@lucide/vue'
import { ref } from 'vue'

import { api, ApiError } from '@/lib/api'
import { useProjects, type Environment, type Project } from '@/lib/context'
import { hasPermission } from '@/lib/session'

const qc = useQueryClient()
const { toast } = useToast()
const projects = useProjects()
const workspaces = useQuery({
  queryKey: ['workspaces'],
  queryFn: () =>
    api<{ data: { id: string; name: string }[] }>('/api/workspaces').then((r) => r.data),
})

const open = ref(false)
const name = ref('')
const workspaceId = ref<string>()
const mode = ref<'platform' | 'byo'>('platform')
const region = ref('eu-west-1')
const error = ref<string>()

async function create() {
  error.value = undefined
  try {
    await api('/api/projects', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        name: name.value,
        workspaceId: workspaceId.value ?? workspaces.data.value?.[0]?.id,
        infrastructureMode: mode.value,
        region: region.value,
      }),
    })
    open.value = false
    name.value = ''
    await qc.invalidateQueries({ queryKey: ['projects'] })
    toast({ title: 'Project created', tone: 'success' })
  } catch (e) {
    error.value = e instanceof ApiError ? e.code : 'Could not create the project.'
  }
}

async function patchEnv(p: Project, e: Environment, body: Record<string, unknown>) {
  await api(`/api/projects/${p.id}/environments/${e.id}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
  await qc.invalidateQueries({ queryKey: ['projects'] })
}

const regions = [
  'eu-west-1',
  'eu-central-1',
  'us-east-1',
  'us-west-2',
  'ap-south-1',
  'ap-southeast-2',
].map((r) => ({ value: r, label: r }))
</script>

<template>
  <section class="flex flex-col gap-4">
    <div class="flex items-center justify-between gap-3">
      <p class="text-sm text-fg-muted">
        Projects hold domains, keys, templates and webhooks. Each has its own environments.
      </p>
      <KDialog v-if="hasPermission('project', 'create')" v-model:open="open" title="New project">
        <template #trigger><KButton size="sm">New project</KButton></template>
        <form id="new-project" class="flex flex-col gap-4" @submit.prevent="create">
          <KTextField
            v-model="name"
            label="Name"
            required
            :message="error"
            :status="error ? 'error' : 'default'"
          />
          <label class="flex flex-col gap-1.5 text-sm font-semibold">
            Workspace
            <KSelect
              v-model="workspaceId"
              :options="workspaces.data.value?.map((w) => ({ value: w.id, label: w.name })) ?? []"
              placeholder="Default workspace"
            />
          </label>
          <label class="flex flex-col gap-1.5 text-sm font-semibold">
            Sending infrastructure
            <KSelect
              v-model="mode"
              :options="[
                { value: 'platform', label: 'Dak-managed AWS' },
                { value: 'byo', label: 'Your AWS account' },
              ]"
            />
          </label>
          <label class="flex flex-col gap-1.5 text-sm font-semibold">
            Region
            <KSelect v-model="region" :options="regions" />
          </label>
        </form>
        <template #footer>
          <KButton variant="ghost" @click="open = false">Cancel</KButton>
          <KButton type="submit" form="new-project">Create project</KButton>
        </template>
      </KDialog>
    </div>

    <KEmptyState
      v-if="projects.data.value?.length === 0"
      :icon="FolderPlus"
      title="No projects yet"
      description="Create a project to verify a domain and send your first email."
    />

    <article
      v-for="p in projects.data.value"
      :key="p.id"
      class="flex flex-col gap-3 rounded-lg border border-line bg-surface p-4"
    >
      <header class="flex flex-wrap items-baseline gap-x-3">
        <h3 class="text-base font-semibold">{{ p.name }}</h3>
        <span class="font-mono text-xs text-fg-muted">{{ p.id }}</span>
        <span class="text-sm text-fg-muted">
          {{ p.infrastructureMode === 'byo' ? 'Your AWS' : 'Dak AWS' }} · {{ p.region }}
        </span>
      </header>
      <ul class="m-0 flex list-none flex-col gap-2 p-0">
        <li
          v-for="e in p.environments"
          :key="e.id"
          class="flex flex-wrap items-center gap-3 rounded-md bg-surface-subtle px-3 py-2"
        >
          <span class="min-w-28 font-semibold">{{ e.name }}</span>
          <KStatusPill
            :status="e.pausedAt ? 'paused' : e.sendingEnabled ? 'active' : 'disabled'"
            :tones="{ paused: 'danger', disabled: 'warning' }"
          />
          <span class="flex-1" />
          <template v-if="hasPermission('infrastructure', 'manage') && e.kind !== 'sandbox'">
            <label class="flex items-center gap-2 text-sm">
              Sending
              <KSwitch
                :model-value="e.sendingEnabled"
                @update:model-value="(v: boolean) => patchEnv(p, e, { sendingEnabled: v })"
              />
            </label>
            <KButton
              size="sm"
              :variant="e.pausedAt ? 'secondary' : 'outline'"
              @click="patchEnv(p, e, { paused: !e.pausedAt })"
            >
              {{ e.pausedAt ? 'Resume' : 'Pause' }}
            </KButton>
          </template>
        </li>
      </ul>
    </article>
  </section>
</template>
