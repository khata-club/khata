<script setup lang="ts">
import { useQuery } from '@tanstack/vue-query'
import { KChartCard, KDataTable, KSegmentedControl, KStat } from '@khata/ui'
import { computed, ref } from 'vue'

import { useCurrent } from '@/lib/context'
import { http } from '@/lib/http'

interface Summary {
  count: number
  p50: number | null
  p95: number | null
  p99: number | null
}
interface Monitoring {
  window: { hours: number; sampled: boolean }
  throughput: { accepted: number; perHour: number[]; hours: string[] }
  stages: Record<'queue' | 'provider' | 'delivery' | 'eventIngest' | 'webhook', Summary>
  outcomes: Record<string, number>
  provider: { throttled: number; failed: number }
  queueAgeMs: number
  webhooks: { succeeded: number; failing: number }
}

const { project, environment } = useCurrent()
const hours = ref('24')
const m = useQuery({
  queryKey: ['monitoring', () => project.value?.id, () => environment.value?.id, hours],
  enabled: computed(() => !!project.value && !!environment.value),
  refetchInterval: 30_000,
  queryFn: () =>
    http.get<Monitoring>(
      `/api/projects/${project.value!.id}/monitoring?environmentId=${environment.value!.id}&hours=${hours.value}`,
    ),
})
const data = computed(() => m.data.value)

function ms(v: number | null | undefined) {
  if (v === null || v === undefined) return '—'
  return v < 1000 ? `${Math.round(v)} ms` : `${(v / 1000).toFixed(2)} s`
}
function rate(n: number, d: number) {
  return d ? `${((n / d) * 100).toFixed(2)}%` : '—'
}

const STAGES = [
  { key: 'queue', label: 'Queue wait' },
  { key: 'provider', label: 'SES request' },
  { key: 'delivery', label: 'Delivery (provider event time)' },
  { key: 'eventIngest', label: 'Event ingestion lag' },
  { key: 'webhook', label: 'Webhook response' },
] as const
const stageRows = computed(() =>
  STAGES.map((s) => {
    const v = data.value?.stages[s.key]
    return {
      key: s.key,
      stage: s.label,
      count: v?.count ?? 0,
      p50: ms(v?.p50),
      p95: ms(v?.p95),
      p99: ms(v?.p99),
    }
  }),
)
const labels = computed(
  () =>
    data.value?.throughput.hours.map(
      (h) => `${String(new Date(h).getHours()).padStart(2, '0')}:00`,
    ) ?? [],
)
const peak = computed(() => Math.max(1, ...(data.value?.throughput.perHour ?? [0])))
</script>

<template>
  <section v-if="data" class="flex flex-col gap-6">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <p class="max-w-prose text-sm text-fg-muted">
        Platform latency is shown per stage. Delivery time comes from provider events and is
        separate from API latency; nothing here guarantees inbox placement.
      </p>
      <KSegmentedControl
        v-model="hours"
        size="sm"
        label="Window"
        :options="[
          { value: '1', label: '1h' },
          { value: '24', label: '24h' },
          { value: '168', label: '7d' },
        ]"
      />
    </div>

    <div class="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <KStat label="Accepted" :value="data.throughput.accepted.toLocaleString()" />
      <KStat
        label="Delivery rate"
        :value="rate(data.outcomes.delivered ?? 0, data.outcomes.submitted ?? 0)"
      />
      <KStat
        label="Hard-bounce rate"
        :value="rate(data.outcomes.bounced ?? 0, data.outcomes.submitted ?? 0)"
        :delta-tone="
          (data.outcomes.bounced ?? 0) / Math.max(1, data.outcomes.submitted ?? 0) > 0.02
            ? 'bad'
            : 'muted'
        "
        delta="SES review above 5%"
      />
      <KStat
        label="Complaint rate"
        :value="rate(data.outcomes.complained ?? 0, data.outcomes.delivered ?? 0)"
        delta="SES review above 0.1%"
        delta-tone="muted"
      />
      <KStat label="Oldest queued" :value="ms(data.queueAgeMs)" size="sm" />
      <KStat label="SES throttles" :value="String(data.provider.throttled)" size="sm" />
      <KStat label="Submission uncertain" :value="String(data.outcomes.uncertain ?? 0)" size="sm" />
      <KStat label="Failing webhooks" :value="String(data.webhooks.failing)" size="sm" />
    </div>

    <KChartCard title="Accepted per hour" kind="Throughput">
      <svg
        role="img"
        :aria-label="`Accepted emails per hour, peak ${peak}`"
        viewBox="0 0 960 180"
        class="h-44 w-full"
        preserveAspectRatio="none"
      >
        <rect
          v-for="(v, i) in data.throughput.perHour"
          :key="i"
          :x="(i * 960) / data.throughput.perHour.length + 2"
          :y="170 - (v / peak) * 160"
          :width="960 / data.throughput.perHour.length - 4"
          :height="Math.max(v ? 2 : 0, (v / peak) * 160)"
          rx="3"
          class="fill-primary"
        >
          <title>{{ labels[i] }}: {{ v }}</title>
        </rect>
        <line x1="0" x2="960" y1="170" y2="170" class="stroke-line" />
      </svg>
      <div class="mt-1 flex justify-between font-mono text-xs text-fg-muted">
        <span>{{ labels[0] }}</span
        ><span>peak {{ peak }}/h</span><span>{{ labels.at(-1) }}</span>
      </div>
    </KChartCard>

    <KDataTable
      :columns="[
        { key: 'stage', label: 'Stage' },
        { key: 'count', label: 'Samples', align: 'right' },
        { key: 'p50', label: 'p50', align: 'right' },
        { key: 'p95', label: 'p95', align: 'right' },
        { key: 'p99', label: 'p99', align: 'right' },
      ]"
      :rows="stageRows"
      row-key="key"
      caption="Stage latency"
    />
    <p v-if="data.window.sampled" class="text-xs text-fg-muted">
      Sampled: the window holds more emails than the live view reads.
    </p>
  </section>
</template>
