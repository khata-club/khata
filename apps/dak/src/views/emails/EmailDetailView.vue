<script setup lang="ts">
import { useQuery } from '@tanstack/vue-query'
import {
  KAlert,
  KDataTable,
  KKeyValue,
  KStat,
  KStatusPill,
  KTabs,
  KTimeline,
  type StatusTone,
  type TimelineItem,
} from '@khata/ui'
import { computed, ref, watch } from 'vue'

import EmailPreview from '@/components/EmailPreview.vue'
import { ApiError } from '@/lib/api'
import { useCurrent } from '@/lib/context'
import { http } from '@/lib/http'

interface Trace {
  email: {
    id: string
    status: string
    stream: string
    fromAddress: string
    subject: string
    reference: string | null
    templateVersionId: string | null
    acceptedAt: number
    scheduledAt: number | null
    expiresAt: number | null
    resendOf: string | null
    traceparent: string | null
    tags: Record<string, string>
  }
  recipients: {
    id: string
    address: string
    kind: string
    status: string
    smtpResponse: string | null
    bounceType: string | null
    opens: number
    clicks: number
  }[]
  attempts: { attempt: number; outcome: string; latencyMs: number; error: string | null }[]
  timeline: {
    id: string
    type: string
    at: number
    ingestedAt: number
    recipient: string | null
    data: Record<string, unknown>
  }[]
  webhooks: {
    id: string
    eventType: string
    status: string
    attempts: number
    lastStatusCode: number | null
    lastLatencyMs: number | null
  }[]
  stages: {
    queueMs: number | null
    providerMs: number | null
    deliveryMs: number | null
    eventLagMs: number | null
  }
}

const props = defineProps<{ id: string }>()
const { project } = useCurrent()
const trace = useQuery({
  queryKey: ['email', () => props.id],
  enabled: computed(() => !!project.value),
  refetchInterval: 5000,
  queryFn: () => http.get<Trace>(`/api/projects/${project.value!.id}/emails/${props.id}`),
})
const data = computed(() => trace.data.value)

const tab = ref('timeline')
const content = ref<{ html: string | null; text: string | null } | null>(null)
const contentError = ref<string>()
watch(tab, async (t) => {
  if (t !== 'content' || content.value) return
  try {
    content.value = await http.get(`/api/projects/${project.value!.id}/emails/${props.id}/content`)
  } catch (e) {
    contentError.value =
      e instanceof ApiError && e.status === 403
        ? 'You need the email-body permission to view production content.'
        : 'Content is no longer retained (zero-body retention or retention window).'
  }
})

const TONES: Record<string, StatusTone> = {
  accepted: 'neutral',
  dispatch_started: 'neutral',
  submitted: 'primary',
  delivery: 'success',
  'sink.delivered': 'success',
  delivery_delay: 'warning',
  bounce: 'danger',
  complaint: 'danger',
  reject: 'danger',
  rejected: 'danger',
  suppressed: 'danger',
  expired: 'warning',
  throttled: 'warning',
  submission_uncertain: 'warning',
  open: 'primary',
  click: 'primary',
}
const LABELS: Record<string, string> = {
  accepted: 'Accepted by the API',
  dispatch_started: 'Picked up from the queue',
  submitted: 'Submitted to SES',
  delivery: 'Accepted by the recipient server',
  delivery_delay: 'Delivery delayed',
  bounce: 'Bounced',
  complaint: 'Complaint',
  open: 'Opened (observed)',
  click: 'Clicked (observed)',
  submission_uncertain: 'Submission uncertain',
}
function ms(v: number | null | undefined) {
  if (v === null || v === undefined) return '—'
  return v < 1000 ? `${Math.round(v)} ms` : `${(v / 1000).toFixed(2)} s`
}
const items = computed<TimelineItem[]>(() => {
  const t = data.value?.timeline ?? []
  return t.map((e, i) => {
    const d = e.data
    const detail = [e.recipient, d.detail, d.bounceType, d.reason, d.code, d.message]
      .filter(Boolean)
      .join(' · ')
    return {
      id: e.id,
      title: LABELS[e.type] ?? e.type.replace(/[._]/g, ' '),
      time: new Date(e.at).toISOString().replace('T', ' ').replace('Z', ''),
      duration: i > 0 ? ms(e.at - t[i - 1]!.at) : undefined,
      description: detail || undefined,
      tone: TONES[e.type] ?? 'neutral',
    }
  })
})
const summary = computed(() => {
  const e = data.value?.email
  if (!e) return []
  return [
    { key: 'id', label: 'Email ID', value: e.id, mono: true },
    { key: 'from', label: 'From', value: e.fromAddress },
    { key: 'subject', label: 'Subject', value: e.subject },
    { key: 'stream', label: 'Stream', value: e.stream },
    { key: 'reference', label: 'Reference', value: e.reference },
    { key: 'template', label: 'Template version', value: e.templateVersionId, mono: true },
    { key: 'resend', label: 'Resend of', value: e.resendOf, mono: true },
    { key: 'trace', label: 'traceparent', value: e.traceparent, mono: true },
  ]
})
const tabs = computed(() => [
  { value: 'timeline', label: 'Timeline', count: data.value?.timeline.length },
  { value: 'recipients', label: 'Recipients', count: data.value?.recipients.length },
  { value: 'webhooks', label: 'Webhooks', count: data.value?.webhooks.length },
  { value: 'content', label: 'Content' },
])
</script>

<template>
  <section v-if="data" class="flex flex-col gap-6">
    <header class="flex flex-wrap items-center gap-3">
      <h2 class="min-w-0 truncate text-2xl font-bold">{{ data.email.subject }}</h2>
      <KStatusPill :status="data.email.status" />
    </header>

    <div class="grid grid-cols-2 gap-3 md:grid-cols-4">
      <KStat label="Queue wait" :value="ms(data.stages.queueMs)" size="sm" />
      <KStat label="SES request" :value="ms(data.stages.providerMs)" size="sm" />
      <KStat label="Delivery" :value="ms(data.stages.deliveryMs)" size="sm" />
      <KStat label="Event lag" :value="ms(data.stages.eventLagMs)" size="sm" />
    </div>

    <KKeyValue :items="summary" />

    <KTabs v-model="tab" :items="tabs" label="Email detail">
      <template #timeline>
        <KTimeline label="Delivery trace" :items="items" />
        <ul v-if="data.attempts.length" class="mt-4 flex list-none flex-col gap-1 p-0 text-sm">
          <li v-for="a in data.attempts" :key="a.attempt">
            Attempt {{ a.attempt }}: <KStatusPill :status="a.outcome" /> {{ ms(a.latencyMs) }}
            <span v-if="a.error" class="text-fg-muted">· {{ a.error }}</span>
          </li>
        </ul>
      </template>
      <template #recipients>
        <KDataTable
          :columns="[
            { key: 'address', label: 'Recipient' },
            { key: 'kind', label: 'Kind', class: 'w-16' },
            { key: 'status', label: 'Status' },
            { key: 'smtpResponse', label: 'SMTP response', class: 'max-lg:hidden text-xs' },
            { key: 'opens', label: 'Opens', align: 'right' },
            { key: 'clicks', label: 'Clicks', align: 'right' },
          ]"
          :rows="data.recipients"
          row-key="id"
          caption="Recipients"
        >
          <template #cell-status="{ value }"><KStatusPill :status="String(value)" /></template>
        </KDataTable>
        <p class="mt-2 text-xs text-fg-muted">
          Opens and clicks are observed signals; privacy proxies and link scanners distort them.
        </p>
      </template>
      <template #webhooks>
        <KDataTable
          :columns="[
            { key: 'eventType', label: 'Event' },
            { key: 'status', label: 'Status' },
            { key: 'attempts', label: 'Tries', align: 'right' },
            { key: 'lastStatusCode', label: 'HTTP', align: 'right' },
          ]"
          :rows="data.webhooks"
          row-key="id"
          caption="Webhook deliveries"
        >
          <template #cell-status="{ value }"
            ><KStatusPill :status="String(value)" :tones="{ dead: 'danger' }"
          /></template>
        </KDataTable>
      </template>
      <template #content>
        <KAlert v-if="contentError" tone="warning" :title="contentError" :dismissible="false" />
        <EmailPreview v-else-if="content?.html" :html="content.html" />
        <pre
          v-else-if="content?.text"
          class="rounded-lg bg-surface-recessed p-4 text-sm whitespace-pre-wrap"
          >{{ content.text }}</pre>
      </template>
    </KTabs>
  </section>
</template>
