<script setup lang="ts">
import { useQuery, useQueryClient } from '@tanstack/vue-query'
import {
  KAlert,
  KAlertDialog,
  KButton,
  KCheckbox,
  KCodeBlock,
  KCopyField,
  KDataTable,
  KDialog,
  KEmptyState,
  KSelect,
  KStatusPill,
  KTextField,
} from '@khata/ui'
import { API_SCOPES } from '@khata/dak-core'
import { KeyRound } from '@lucide/vue'
import { computed, ref } from 'vue'

import { ApiError } from '@/lib/api'
import { useCurrent } from '@/lib/context'
import { http } from '@/lib/http'
import { hasPermission } from '@/lib/session'

interface Key {
  id: string
  name: string
  prefix: string
  environmentId: string
  scopes: string[]
  allowedDomains: string[]
  lastUsedAt: number | null
  createdAt: number
  status: 'active' | 'revoked' | 'expired'
}

const qc = useQueryClient()
const { project, environment } = useCurrent()
const base = computed(() => `/api/projects/${project.value?.id}/api-keys`)

const keys = useQuery({
  queryKey: ['api-keys', () => project.value?.id],
  enabled: computed(() => !!project.value),
  queryFn: () => http.get<{ data: Key[] }>(base.value).then((r) => r.data),
})

const envName = (id: string) => project.value?.environments.find((e) => e.id === id)?.name ?? id
const rows = computed(
  () =>
    keys.data.value?.map((k) => ({
      ...k,
      env: envName(k.environmentId),
      scopeList: k.scopes.join(', '),
      used: k.lastUsedAt ? new Date(k.lastUsedAt).toLocaleString() : 'Never',
    })) ?? [],
)

// Create
const open = ref(false)
const name = ref('')
const environmentId = ref<string>()
const scopes = ref<string[]>(['emails:send'])
const error = ref<string>()
const issued = ref<{ key: string }>()

function toggleScope(s: string, on: boolean) {
  scopes.value = on ? [...new Set([...scopes.value, s])] : scopes.value.filter((x) => x !== s)
}

async function create() {
  error.value = undefined
  try {
    issued.value = await http.post<{ key: string }>(base.value, {
      name: name.value,
      environmentId: environmentId.value ?? environment.value?.id,
      scopes: scopes.value,
    })
    name.value = ''
    await qc.invalidateQueries({ queryKey: ['api-keys'] })
  } catch (e) {
    error.value = e instanceof ApiError ? e.code.replace(/_/g, ' ') : 'Could not create the key.'
  }
}

async function revoke(id: string) {
  await http.del(`${base.value}/${id}`)
  await qc.invalidateQueries({ queryKey: ['api-keys'] })
}

async function roll(id: string) {
  issued.value = await http.post<{ key: string }>(`${base.value}/${id}/roll`)
  open.value = true
  await qc.invalidateQueries({ queryKey: ['api-keys'] })
}

const envOptions = computed(
  () =>
    project.value?.environments.map((e) => ({ value: e.id, label: `${e.name} (${e.kind})` })) ?? [],
)
const columns = [
  { key: 'name' as const, label: 'Name' },
  { key: 'prefix' as const, label: 'Key', class: 'font-mono text-xs' },
  { key: 'env' as const, label: 'Environment', class: 'max-md:hidden' },
  { key: 'scopeList' as const, label: 'Scopes', class: 'max-lg:hidden text-xs' },
  { key: 'used' as const, label: 'Last used', class: 'max-lg:hidden' },
  { key: 'status' as const, label: 'Status' },
  { key: 'id' as const, label: '', align: 'right' as const },
]
const snippet = computed(
  () =>
    `curl https://api.dak.khata.club/v1/me \\\n  -H "Authorization: Bearer ${issued.value?.key ?? 'dak_…'}"`,
)
</script>

<template>
  <section class="flex flex-col gap-4">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <p class="max-w-prose text-sm text-fg-muted">
        Keys belong to one environment. New keys can only send email; add scopes only where needed.
      </p>
      <KDialog
        v-if="hasPermission('apiKey', 'manage') && project"
        v-model:open="open"
        :title="issued ? 'Copy your API key' : 'Create an API key'"
        @update:open="(v: boolean) => !v && (issued = undefined)"
      >
        <template #trigger><KButton size="sm">Create key</KButton></template>
        <div v-if="issued" class="flex flex-col gap-4">
          <KAlert
            tone="warning"
            title="This is the only time the key is shown."
            :dismissible="false"
          >
            Store it in your secret manager. Dak keeps only a hash.
          </KAlert>
          <KCopyField label="API key" :value="issued.key" />
          <KCodeBlock language="bash" title="Check it works" :code="snippet" />
        </div>
        <form v-else id="create-key" class="flex flex-col gap-4" @submit.prevent="create">
          <KTextField
            v-model="name"
            label="Name"
            placeholder="Production backend"
            required
            :status="error ? 'error' : 'default'"
            :message="error"
          />
          <label class="flex flex-col gap-1.5 text-sm font-semibold">
            Environment
            <KSelect
              :model-value="environmentId ?? environment?.id"
              :options="envOptions"
              @update:model-value="(v) => (environmentId = v)"
            />
          </label>
          <fieldset class="m-0 flex flex-col gap-2 border-0 p-0">
            <legend class="mb-1 text-sm font-semibold">Scopes</legend>
            <label
              v-for="s in API_SCOPES"
              :key="s"
              class="flex items-center gap-2 font-mono text-sm"
            >
              <KCheckbox
                :model-value="scopes.includes(s)"
                @update:model-value="(v: boolean | 'indeterminate') => toggleScope(s, v === true)"
              />
              {{ s }}
            </label>
          </fieldset>
        </form>
        <template #footer>
          <KButton variant="ghost" @click="open = false">{{ issued ? 'Done' : 'Cancel' }}</KButton>
          <KButton v-if="!issued" type="submit" form="create-key" :disabled="!scopes.length"
            >Create key</KButton
          >
        </template>
      </KDialog>
    </div>

    <KDataTable
      :columns="columns"
      :rows="rows"
      row-key="id"
      caption="API keys"
      :loading="keys.isPending.value && !!project"
    >
      <template #cell-status="{ value }"><KStatusPill :status="String(value)" /></template>
      <template #cell-id="{ row }">
        <div
          v-if="row.status === 'active' && hasPermission('apiKey', 'manage')"
          class="flex justify-end gap-1"
        >
          <KAlertDialog
            title="Roll this key?"
            description="A new key is issued with the same settings and the current key stops working immediately."
            confirm-label="Roll key"
            @confirm="roll(row.id)"
          >
            <template #trigger><KButton size="sm" variant="ghost">Roll</KButton></template>
          </KAlertDialog>
          <KAlertDialog
            title="Revoke this key?"
            description="Requests using it fail immediately. This cannot be undone."
            confirm-label="Revoke"
            @confirm="revoke(row.id)"
          >
            <template #trigger><KButton size="sm" variant="ghost">Revoke</KButton></template>
          </KAlertDialog>
        </div>
      </template>
      <template #empty>
        <KEmptyState
          :icon="KeyRound"
          title="No API keys"
          description="Create a key to call the Dak API from your backend."
        />
      </template>
    </KDataTable>
  </section>
</template>
