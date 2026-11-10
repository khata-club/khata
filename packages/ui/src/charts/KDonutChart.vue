<script setup lang="ts">
import { computed, ref, useTemplateRef } from 'vue'

import { useChartReveal, useChartTheme, type ChartSettings } from './context'
import KChartCard from './KChartCard.vue'
import { CHART, seriesColor } from './lib/palette'
import { dur, money, round1 } from './lib/scale'

export interface DonutItem {
  label: string
  value: number
}

const {
  items,
  centerLabel = 'Total',
  title = 'Spending by category',
  index,
  kind,
  showGrid = undefined,
  ...settings
} = defineProps<
  {
    items: DonutItem[]
    centerLabel?: string
    title?: string
    index?: string
    /** Short mono descriptor shown at the right of the header. */
    kind?: string
  } & ChartSettings
>()

const card = useTemplateRef<InstanceType<typeof KChartCard>>('card')
const theme = useChartTheme(() => ({ ...settings, showGrid }))
const { revealed, replay } = useChartReveal(card, () => theme.value.durationScale)
const hover = ref<number | null>(null)

const model = computed(() => {
  const total = items.reduce((a, item) => a + item.value, 0)
  let start = 0
  const segs = items.map((item, i) => {
    const share = total > 0 ? (item.value / total) * 100 : 0
    // Leave a small gap between segments.
    const len = Math.max(share - 0.9, 0.1)
    const seg = {
      ...item,
      v: money(item.value),
      pct: Math.round(share) + '%',
      c: seriesColor(theme.value.series, i),
      da: revealed.value ? `${round1(len)} ${round1(100 - len)}` : '0 100',
      off: round1(-start),
      sw: hover.value === i ? 26 : 20,
      op: hover.value == null || hover.value === i ? 1 : 0.35,
      dl: i * 120,
    }
    start += share
    return seg
  })
  const active = hover.value
  return {
    total,
    segs,
    label: active == null ? centerLabel : items[active]!.label,
    value: money(active == null ? total : items[active]!.value),
    sub: active == null ? `${items.length} categories` : segs[active]!.pct + ' of total',
  }
})

defineExpose({ replay })
</script>

<template>
  <KChartCard
    ref="card"
    :title="title"
    :index="index"
    :kind="kind"
    :duration-scale="theme.durationScale"
    :empty="!(model.total > 0)"
  >
    <div class="flex flex-wrap items-center gap-8">
      <div class="relative mx-auto aspect-square w-[220px] max-w-full flex-none">
        <svg viewBox="0 0 200 200" class="block size-full overflow-visible" aria-hidden="true">
          <circle cx="100" cy="100" r="78" fill="none" :stroke="CHART.track" stroke-width="20" />
          <g transform="rotate(-90 100 100)">
            <circle
              v-for="(s, i) in model.segs"
              :key="i"
              cx="100"
              cy="100"
              r="78"
              fill="none"
              pathLength="100"
              :stroke="s.c"
              class="cursor-pointer"
              :style="{
                strokeWidth: s.sw,
                strokeDasharray: s.da,
                strokeDashoffset: s.off,
                opacity: s.op,
                transition: `stroke-dasharray ${dur(800)} var(--ease-standard) ${dur(s.dl)}, stroke-width var(--duration-slow) var(--ease-standard), opacity var(--duration-normal) var(--ease-standard)`,
              }"
              @pointerenter="hover = i"
              @pointerleave="hover = null"
            />
          </g>
        </svg>
        <div
          class="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-0.5 text-center"
        >
          <span class="text-xs font-semibold tracking-label text-fg-muted uppercase">{{
            model.label
          }}</span>
          <span class="text-2xl font-semibold tabular-nums">{{ model.value }}</span>
          <span class="font-mono text-xs text-fg-muted">{{ model.sub }}</span>
        </div>
      </div>
      <!-- The legend doubles as an accessible table of the data. -->
      <ul class="m-0 flex flex-[1_1_180px] list-none flex-col p-0" :aria-label="title">
        <li
          v-for="(s, i) in model.segs"
          :key="i"
          class="grid cursor-pointer grid-cols-[12px_minmax(0,1fr)_auto_40px] items-center gap-3 border-t border-line py-2 transition-opacity duration-(--duration-normal)"
          :style="{ opacity: s.op }"
          @pointerenter="hover = i"
          @pointerleave="hover = null"
        >
          <span class="size-2.5 rounded-[3px]" :style="{ background: s.c }" />
          <span class="text-sm font-semibold">{{ s.label }}</span>
          <span class="font-mono text-xs tabular-nums">{{ s.v }}</span>
          <span class="text-right font-mono text-xs text-fg-muted">{{ s.pct }}</span>
        </li>
      </ul>
    </div>
  </KChartCard>
</template>
