<script setup lang="ts">
import { useQuery, useQueryClient } from '@tanstack/vue-query'
import {
  KButton,
  KDataTable,
  KDialog,
  KEmptyState,
  KSelect,
  KStatusPill,
  KTextField,
} from '@khata/ui'
import { FileCode2 } from '@lucide/vue'
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'

import { ApiError } from '@/lib/api'
import { useCurrent } from '@/lib/context'
import { http } from '@/lib/http'
import { hasPermission } from '@/lib/session'

interface Row {
  id: string
  alias: string
  name: string
  editor: string
  publishedVersion: number | null
  hasDraft: boolean
  updatedAt: number
}

const router = useRouter()
const qc = useQueryClient()
const { project } = useCurrent()
const base = computed(() => `/api/projects/${project.value?.id}/templates`)
const list = useQuery({
  queryKey: ['templates', () => project.value?.id],
  enabled: computed(() => !!project.value),
  queryFn: () => http.get<{ data: Row[] }>(base.value).then((r) => r.data),
})
const rows = computed(
  () =>
    list.data.value?.map((t) => ({
      ...t,
      state: t.publishedVersion ? (t.hasDraft ? 'draft_changes' : 'published') : 'draft',
      version: t.publishedVersion ? `v${t.publishedVersion}` : '—',
      updated: new Date(t.updatedAt).toLocaleDateString(),
    })) ?? [],
)

const starters = useQuery({
  queryKey: ['template-starters', () => project.value?.id],
  enabled: computed(() => !!project.value),
  queryFn: () =>
    http
      .get<{ data: { id: string; name: string; description: string }[] }>(`${base.value}/starters`)
      .then((r) => r.data),
})
const starterOptions = computed(() => [
  { value: 'visual', label: 'Blank (visual editor)' },
  { value: 'code', label: 'Blank (HTML editor)' },
  ...(starters.data.value ?? []).map((s) => ({ value: `starter:${s.id}`, label: s.name })),
])
const startFrom = ref('visual')

const open = ref(false)
const name = ref('')
const alias = ref('')
const error = ref<string>()
async function create() {
  error.value = undefined
  try {
    const t = await http.post<{ id: string }>(base.value, {
      name: name.value,
      alias:
        alias.value ||
        name.value
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-|-$/g, ''),
      ...(startFrom.value.startsWith('starter:')
        ? { starter: startFrom.value.slice(8) }
        : startFrom.value === 'visual'
          ? {
              blocks: {
                blocks: [
                  { type: 'header' },
                  { type: 'text', content: 'Hello {{ name }},', align: 'left', size: 'body' },
                ],
              },
            }
          : { editor: 'code' }),
    })
    await qc.invalidateQueries({ queryKey: ['templates'] })
    await router.push({ name: 'template', params: { id: t.id } })
  } catch (e) {
    error.value =
      e instanceof ApiError ? e.code.replace(/_/g, ' ') : 'Could not create the template.'
  }
}

const columns = [
  { key: 'name' as const, label: 'Name' },
  { key: 'alias' as const, label: 'Alias', class: 'font-mono text-xs max-md:hidden' },
  { key: 'state' as const, label: 'State' },
  { key: 'version' as const, label: 'Live', class: 'w-20' },
  { key: 'updated' as const, label: 'Updated', class: 'max-lg:hidden' },
]
</script>

<template>
  <section class="flex flex-col gap-4">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <p class="max-w-prose text-sm text-fg-muted">
        Published versions are immutable. Sends pin the version they rendered, so editing never
        changes mail that is already queued.
      </p>
      <KDialog
        v-if="hasPermission('template', 'write') && project"
        v-model:open="open"
        title="New template"
      >
        <template #trigger><KButton size="sm">New template</KButton></template>
        <form id="new-template" class="flex flex-col gap-4" @submit.prevent="create">
          <KTextField v-model="name" label="Name" required placeholder="Password reset" />
          <label class="flex flex-col gap-1.5 text-sm font-semibold">
            Start from <KSelect v-model="startFrom" :options="starterOptions" />
          </label>
          <KTextField
            v-model="alias"
            label="Alias"
            mono
            hint="Used by the API, e.g. password-reset. Defaults to the name."
            :status="error ? 'error' : 'default'"
            :message="error"
          />
        </form>
        <template #footer>
          <KButton variant="ghost" @click="open = false">Cancel</KButton>
          <KButton type="submit" form="new-template">Create</KButton>
        </template>
      </KDialog>
    </div>
    <KDataTable
      :columns="columns"
      :rows="rows"
      row-key="id"
      caption="Templates"
      clickable
      :loading="list.isPending.value && !!project"
      @row-click="(r) => router.push({ name: 'template', params: { id: r.id } })"
    >
      <template #cell-state="{ value }">
        <KStatusPill
          :status="String(value)"
          :tones="{ draft_changes: 'warning', draft: 'neutral', published: 'success' }"
        />
      </template>
      <template #empty>
        <KEmptyState
          :icon="FileCode2"
          title="No templates yet"
          description="Create a template to send consistent, versioned email."
        />
      </template>
    </KDataTable>
  </section>
</template>
