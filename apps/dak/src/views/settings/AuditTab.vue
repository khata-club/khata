<script setup lang="ts">
import { useQuery } from '@tanstack/vue-query'
import { KDataTable } from '@khata/ui'
import { computed, ref } from 'vue'

import { api } from '@/lib/api'

interface AuditRow {
  id: string
  actor: string
  action: string
  targetType: string | null
  targetId: string | null
  createdAt: number
}

const cursors = ref<(string | undefined)[]>([undefined])
const before = computed(() => cursors.value.at(-1))
const page = useQuery({
  queryKey: ['audit', before],
  queryFn: () =>
    api<{ data: AuditRow[]; nextCursor: string | null }>(
      `/api/audit${before.value ? `?before=${before.value}` : ''}`,
    ),
})
const rows = computed(
  () =>
    page.data.value?.data.map((r) => ({
      ...r,
      when: new Date(r.createdAt).toLocaleString(),
      target: r.targetId ?? '—',
    })) ?? [],
)
const columns = [
  { key: 'when' as const, label: 'When', class: 'w-48' },
  { key: 'action' as const, label: 'Action' },
  { key: 'actor' as const, label: 'Actor', class: 'max-md:hidden font-mono text-xs' },
  { key: 'target' as const, label: 'Target', class: 'max-lg:hidden font-mono text-xs' },
]
</script>

<template>
  <KDataTable
    :columns="columns"
    :rows="rows"
    row-key="id"
    caption="Audit log"
    :loading="page.isPending.value"
    :has-previous="cursors.length > 1"
    :has-next="!!page.data.value?.nextCursor"
    @next="cursors.push(page.data.value!.nextCursor!)"
    @previous="cursors.pop()"
  />
</template>
