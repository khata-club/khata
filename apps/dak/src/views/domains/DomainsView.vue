<script setup lang="ts">
import { useQuery, useQueryClient } from '@tanstack/vue-query'
import { KButton, KDataTable, KDialog, KEmptyState, KStatusPill, KTextField } from '@khata/ui'
import { Globe } from '@lucide/vue'
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'

import { ApiError } from '@/lib/api'
import { useCurrent } from '@/lib/context'
import { http } from '@/lib/http'
import { hasPermission } from '@/lib/session'
import type { Domain } from './types'

const router = useRouter()
const qc = useQueryClient()
const { project } = useCurrent()
const projectId = computed(() => project.value?.id)

const domains = useQuery({
  queryKey: ['domains', projectId],
  enabled: computed(() => !!projectId.value),
  queryFn: () =>
    http.get<{ data: Domain[] }>(`/api/projects/${projectId.value}/domains`).then((r) => r.data),
})

const rows = computed(
  () =>
    domains.data.value?.map((d) => ({
      ...d,
      senderCount: d.senders.length,
      checked: d.lastCheckedAt ? new Date(d.lastCheckedAt).toLocaleString() : '—',
    })) ?? [],
)

const open = ref(false)
const name = ref('')
const error = ref<string>()
const busy = ref(false)

async function add() {
  busy.value = true
  error.value = undefined
  try {
    const created = await http.post<{ id: string }>(`/api/projects/${projectId.value}/domains`, {
      name: name.value,
    })
    await qc.invalidateQueries({ queryKey: ['domains'] })
    open.value = false
    await router.push({ name: 'domain', params: { id: created.id } })
  } catch (e) {
    error.value =
      e instanceof ApiError
        ? ({
            invalid_domain: 'Enter a domain such as example.com.',
            domain_taken: 'Another organization uses this domain.',
            conflict: 'Already added.',
            aws_not_connected: 'Connect an AWS account to this project first.',
          }[e.code] ?? e.code)
        : 'Could not add the domain.'
  } finally {
    busy.value = false
  }
}

const columns = [
  { key: 'name' as const, label: 'Domain', sortable: false },
  { key: 'status' as const, label: 'Status', class: 'w-40' },
  { key: 'region' as const, label: 'Region', class: 'max-md:hidden w-32' },
  {
    key: 'senderCount' as const,
    label: 'Senders',
    align: 'right' as const,
    class: 'max-md:hidden w-24',
  },
  { key: 'checked' as const, label: 'Last checked', class: 'max-lg:hidden w-48' },
]
</script>

<template>
  <section class="flex flex-col gap-4">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <p class="max-w-prose text-sm text-fg-muted">
        Send from your own domain with DKIM signing and an aligned MAIL FROM, so mail passes SPF,
        DKIM and DMARC.
      </p>
      <KDialog
        v-if="hasPermission('domain', 'manage') && project"
        v-model:open="open"
        title="Add a domain"
      >
        <template #trigger><KButton size="sm">Add domain</KButton></template>
        <form id="add-domain" class="flex flex-col gap-3" @submit.prevent="add">
          <KTextField
            v-model="name"
            label="Domain"
            placeholder="example.com"
            hint="Use a subdomain such as mail.example.com to keep marketing reputation separate."
            :status="error ? 'error' : 'default'"
            :message="error"
            required
          />
        </form>
        <template #footer>
          <KButton variant="ghost" @click="open = false">Cancel</KButton>
          <KButton type="submit" form="add-domain" :loading="busy">Add domain</KButton>
        </template>
      </KDialog>
    </div>

    <KDataTable
      :columns="columns"
      :rows="rows"
      row-key="id"
      caption="Sending domains"
      :loading="domains.isPending.value && !!projectId"
      clickable
      @row-click="(r) => router.push({ name: 'domain', params: { id: r.id } })"
    >
      <template #cell-status="{ value }"><KStatusPill :status="String(value)" /></template>
      <template #empty>
        <KEmptyState
          :icon="Globe"
          title="No domains yet"
          :description="
            project
              ? 'Add a domain to send from your own address.'
              : 'Create a project first in Team & settings.'
          "
        />
      </template>
    </KDataTable>
  </section>
</template>
