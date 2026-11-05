<script setup lang="ts">
import { useQuery } from '@tanstack/vue-query'
import { KDataTable, KEmptyState, KSearchInput, KSelect, KStatusPill } from '@khata/ui'
import { Mail } from '@lucide/vue'
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'

import { useCurrent } from '@/lib/context'
import { http } from '@/lib/http'

interface Row {
  id: string
  status: string
  stream: string
  subject: string
  to: string | null
  recipients: number
  outcome: string
  reference: string | null
  acceptedAt: number
}

const router = useRouter()
const { project, environment } = useCurrent()
const q = ref('')
const search = ref('')
const stream = ref('all')
const cursors = ref<(string | undefined)[]>([undefined])
let t: ReturnType<typeof setTimeout> | undefined
watch(q, (v) => {
  clearTimeout(t)
  t = setTimeout(() => {
    search.value = v.trim()
    cursors.value = [undefined]
  }, 300)
})
watch([stream, () => environment.value?.id], () => (cursors.value = [undefined]))

const params = computed(() => {
  const p = new URLSearchParams({ environmentId: environment.value?.id ?? '' })
  if (search.value) p.set('q', search.value)
  if (stream.value !== 'all') p.set('stream', stream.value)
  const before = cursors.value.at(-1)
  if (before) p.set('before', before)
  return p.toString()
})
const list = useQuery({
  queryKey: ['emails', () => project.value?.id, params],
  enabled: computed(() => !!project.value && !!environment.value),
  refetchInterval: 10_000,
  queryFn: () =>
    http.get<{ data: Row[]; nextCursor: string | null }>(
      `/api/projects/${project.value!.id}/emails?${params.value}`,
    ),
})
const rows = computed(
  () =>
    list.data.value?.data.map((r) => ({
      ...r,
      when: new Date(r.acceptedAt).toLocaleString(),
      toLabel: r.recipients > 1 ? `${r.to} +${r.recipients - 1}` : r.to,
    })) ?? [],
)
const loading = computed(() => list.isPending.value && !!project.value)
const nextCursor = computed(() => list.data.value?.nextCursor ?? null)

const columns = [
  { key: 'when' as const, label: 'Accepted', class: 'w-44' },
  { key: 'toLabel' as const, label: 'To' },
  { key: 'subject' as const, label: 'Subject', class: 'max-md:hidden' },
  { key: 'stream' as const, label: 'Stream', class: 'max-lg:hidden' },
  { key: 'outcome' as const, label: 'Outcome' },
]
const streams = ['all', 'authentication', 'transactional', 'notifications', 'marketing'].map(
  (s) => ({
    value: s,
    label: s === 'all' ? 'All streams' : s[0]!.toUpperCase() + s.slice(1),
  }),
)
</script>

<template>
  <section class="flex flex-col gap-4">
    <div class="flex flex-wrap items-end gap-3">
      <KSearchInput
        v-model="q"
        class="min-w-64 flex-1"
        placeholder="Email ID, provider message ID, reference or exact recipient"
        label="Search emails"
      />
      <KSelect v-model="stream" class="w-48" :options="streams" aria-label="Stream" />
    </div>
    <KDataTable
      :columns="columns"
      :rows="rows"
      row-key="id"
      caption="Emails"
      clickable
      :loading="loading"
      :has-previous="cursors.length > 1"
      :has-next="!!nextCursor"
      @next="cursors.push(nextCursor!)"
      @previous="cursors.pop()"
      @row-click="(r) => router.push({ name: 'email', params: { id: r.id } })"
    >
      <template #cell-outcome="{ value }"><KStatusPill :status="String(value)" /></template>
      <template #empty>
        <KEmptyState
          :icon="Mail"
          title="No emails yet"
          :description="
            search
              ? 'Nothing matches that search.'
              : 'Emails sent with this environment’s keys appear here.'
          "
        />
      </template>
    </KDataTable>
  </section>
</template>
