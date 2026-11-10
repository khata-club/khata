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
  KStatusPill,
  KSwitch,
  KTextField,
  useToast,
} from '@khata/ui'
import { WEBHOOK_EVENT_TYPES } from '@khata/dak-core'
import { Webhook } from '@lucide/vue'
import { computed, ref } from 'vue'

import { ApiError } from '@/lib/api'
import { useCurrent } from '@/lib/context'
import { http } from '@/lib/http'
import { hasPermission } from '@/lib/session'

interface Endpoint {
  id: string
  url: string
  environmentId: string
  eventTypes: string[]
  disabledAt: number | null
  rotating: boolean
}
interface Delivery {
  id: string
  eventId: string
  eventType: string
  status: string
  attempts: number
  lastStatusCode: number | null
  lastError: string | null
  lastLatencyMs: number | null
  createdAt: number
}

const qc = useQueryClient()
const { toast } = useToast()
const { project, environment } = useCurrent()
const base = computed(() => `/api/projects/${project.value?.id}/webhooks`)
const list = useQuery({
  queryKey: ['webhooks', () => project.value?.id],
  enabled: computed(() => !!project.value),
  queryFn: () => http.get<{ data: Endpoint[] }>(base.value).then((r) => r.data),
})

const endpoints = computed(() => list.data.value)
const selected = ref<string>()
const deliveries = useQuery({
  queryKey: ['webhook-deliveries', selected],
  enabled: computed(() => !!selected.value),
  refetchInterval: 5000,
  queryFn: () =>
    http
      .get<{ data: Delivery[] }>(`${base.value}/${selected.value}/deliveries`)
      .then((r) => r.data),
})
const deliveriesLoading = computed(() => deliveries.isPending.value)
const deliveryRows = computed(
  () =>
    deliveries.data.value?.map((d) => ({
      ...d,
      when: new Date(d.createdAt).toLocaleString(),
      response: d.lastStatusCode
        ? `${d.lastStatusCode} · ${d.lastLatencyMs} ms`
        : (d.lastError ?? '—'),
    })) ?? [],
)

// Create
const open = ref(false)
const url = ref('')
const types = ref<string[]>(['*'])
const error = ref<string>()
const secret = ref<string>()
async function create() {
  error.value = undefined
  try {
    const r = await http.post<{ secret: string }>(base.value, {
      url: url.value,
      environmentId: environment.value?.id,
      eventTypes: types.value,
    })
    secret.value = r.secret
    url.value = ''
    await qc.invalidateQueries({ queryKey: ['webhooks'] })
  } catch (e) {
    error.value =
      e instanceof ApiError ? e.code.replace(/_/g, ' ') : 'Could not create the endpoint.'
  }
}
function toggleType(t: string, on: boolean) {
  if (t === '*') return (types.value = on ? ['*'] : [])
  const rest = types.value.filter((x) => x !== '*' && x !== t)
  types.value = on ? [...rest, t] : rest
}

async function rotate(id: string) {
  const r = await http.post<{ secret: string }>(`${base.value}/${id}/rotate`)
  secret.value = r.secret
  open.value = true
  await qc.invalidateQueries({ queryKey: ['webhooks'] })
}
async function setEnabled(e: Endpoint, on: boolean) {
  await http.patch(`${base.value}/${e.id}`, { disabled: !on })
  await qc.invalidateQueries({ queryKey: ['webhooks'] })
}
async function remove(id: string) {
  await http.del(`${base.value}/${id}`)
  if (selected.value === id) selected.value = undefined
  await qc.invalidateQueries({ queryKey: ['webhooks'] })
}
async function test(id: string) {
  await http.post(`${base.value}/${id}/test`)
  selected.value = id
  toast({ title: 'Test event queued' })
}
async function replay(d: Delivery) {
  await http.post(`${base.value}/${selected.value}/deliveries/${d.id}/replay`)
  toast({
    title: 'Replay queued',
    description: `Same event ID ${d.eventId}; the email is not resent.`,
  })
  await qc.invalidateQueries({ queryKey: ['webhook-deliveries'] })
}

const verifySnippet = `import { verifyWebhook } from '@khata/dak'

const event = await verifyWebhook(process.env.DAK_WEBHOOK_SECRET, rawBody, request.headers)
// Deduplicate on event.id: deliveries are at least once and may arrive out of order.`

const columns = [
  { key: 'when' as const, label: 'Time', class: 'w-44' },
  { key: 'eventType' as const, label: 'Event' },
  { key: 'status' as const, label: 'Status' },
  { key: 'attempts' as const, label: 'Tries', align: 'right' as const, class: 'w-16' },
  { key: 'response' as const, label: 'Response', class: 'max-lg:hidden' },
  { key: 'id' as const, label: '', align: 'right' as const },
]
</script>

<template>
  <section class="flex flex-col gap-4">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <p class="max-w-prose text-sm text-fg-muted">
        Signed (Standard Webhooks), retried with backoff and replayable. Endpoints receive events
        for the current environment.
      </p>
      <KDialog
        v-if="hasPermission('webhook', 'manage') && project"
        v-model:open="open"
        :title="secret ? 'Signing secret' : 'Add endpoint'"
        @update:open="(v: boolean) => !v && (secret = undefined)"
      >
        <template #trigger><KButton size="sm">Add endpoint</KButton></template>
        <div v-if="secret" class="flex flex-col gap-4">
          <KAlert
            tone="warning"
            title="Copy the secret now; it is not shown again."
            :dismissible="false"
          />
          <KCopyField label="Signing secret" :value="secret" />
          <KCodeBlock language="ts" title="Verify deliveries" :code="verifySnippet" />
        </div>
        <form v-else id="add-webhook" class="flex flex-col gap-4" @submit.prevent="create">
          <KTextField
            v-model="url"
            label="Endpoint URL"
            placeholder="https://example.com/webhooks/dak"
            mono
            required
            :status="error ? 'error' : 'default'"
            :message="error"
          />
          <fieldset class="m-0 grid grid-cols-2 gap-2 border-0 p-0">
            <legend class="mb-1 text-sm font-semibold">Events</legend>
            <label
              v-for="t in ['*', ...WEBHOOK_EVENT_TYPES]"
              :key="t"
              class="flex items-center gap-2 font-mono text-xs"
            >
              <KCheckbox
                :model-value="types.includes(t) || (t !== '*' && types.includes('*'))"
                :disabled="t !== '*' && types.includes('*')"
                @update:model-value="(v: boolean | 'indeterminate') => toggleType(t, v === true)"
              />
              {{ t === '*' ? 'All events' : t }}
            </label>
          </fieldset>
        </form>
        <template #footer>
          <KButton variant="ghost" @click="open = false">{{ secret ? 'Done' : 'Cancel' }}</KButton>
          <KButton v-if="!secret" type="submit" form="add-webhook" :disabled="!types.length"
            >Add endpoint</KButton
          >
        </template>
      </KDialog>
    </div>

    <KEmptyState
      v-if="endpoints?.length === 0"
      :icon="Webhook"
      title="No endpoints"
      description="Receive delivery, bounce and engagement events as they happen."
    />

    <article
      v-for="e in endpoints"
      :key="e.id"
      class="flex flex-wrap items-center gap-3 rounded-lg border bg-surface px-4 py-3"
      :class="selected === e.id ? 'border-primary' : 'border-line'"
    >
      <button
        type="button"
        class="min-w-0 flex-1 cursor-pointer border-0 bg-transparent p-0 text-left"
        @click="selected = e.id"
      >
        <span class="block truncate font-mono text-sm">{{ e.url }}</span>
        <span class="text-xs text-fg-muted">{{
          e.eventTypes.includes('*') ? 'All events' : e.eventTypes.join(', ')
        }}</span>
      </button>
      <KStatusPill v-if="e.rotating" status="rotating" :tones="{ rotating: 'warning' }" />
      <template v-if="hasPermission('webhook', 'manage')">
        <KSwitch
          :model-value="!e.disabledAt"
          :aria-label="`Enable ${e.url}`"
          @update:model-value="(v: boolean) => setEnabled(e, v)"
        />
        <KButton size="sm" variant="ghost" @click="test(e.id)">Send test</KButton>
        <KAlertDialog
          title="Rotate the signing secret?"
          description="A new secret is issued. Deliveries carry both signatures for 24 hours so you can switch without downtime."
          confirm-label="Rotate"
          @confirm="rotate(e.id)"
        >
          <template #trigger><KButton size="sm" variant="ghost">Rotate secret</KButton></template>
        </KAlertDialog>
        <KAlertDialog
          title="Delete this endpoint?"
          description="Pending deliveries are dropped."
          confirm-label="Delete"
          @confirm="remove(e.id)"
        >
          <template #trigger><KButton size="sm" variant="ghost">Delete</KButton></template>
        </KAlertDialog>
      </template>
    </article>

    <section v-if="selected" class="flex flex-col gap-2">
      <h3 class="text-lg font-semibold">Deliveries</h3>
      <KDataTable
        :columns="columns"
        :rows="deliveryRows"
        row-key="id"
        caption="Webhook deliveries"
        :loading="deliveriesLoading"
      >
        <template #cell-status="{ value }">
          <KStatusPill :status="String(value)" :tones="{ dead: 'danger', pending: 'neutral' }" />
        </template>
        <template #cell-id="{ row }">
          <KButton
            v-if="hasPermission('webhook', 'manage') && row.status !== 'pending'"
            size="sm"
            variant="ghost"
            @click="replay(row)"
          >
            Replay
          </KButton>
        </template>
      </KDataTable>
    </section>
  </section>
</template>
