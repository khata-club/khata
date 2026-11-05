<script setup lang="ts">
import { computed, ref } from 'vue'

import { cn } from '../lib/cn'
import { useChartReveal, useChartTheme, type ChartSettings } from './context'
import KChartCard from './KChartCard.vue'
import { CHART } from './lib/palette'
import { dur, f, money } from './lib/scale'

export interface DonutItem {
  label: string
  value: number
}

const {
  items,
  centerLabel = 'Total',
  title = 'Spending by category',
  index,
  kind = 'Donut',
  ...settings
} = defineProps<
  {
    items: DonutItem[]
    centerLabel?: string
    title?: string
    index?: string
    kind?: string
  } & ChartSettings
>()

const card = ref()
const theme = useChartTheme(() => settings)
const { revealed, replay } = useChartReveal(card, () => theme.value.k)
const hover = ref<number | null>(null)

const model = computed(() => {
  const tot = items.reduce((a, c) => a + c.value, 0)
  let c = 0
  const segs = items.map((it, i) => {
    const pct = (it.value / tot) * 100
    const len = Math.max(pct - 0.9, 0.1)
    const o = {
      ...it,
      v: money(it.value),
      pct: Math.round(pct) + '%',
      c: theme.value.P[i % theme.value.P.length]!,
      da: revealed.value ? `${f(len)} ${f(100 - len)}` : '0 100',
      off: f(-c),
      sw: hover.value === i ? 26 : 20,
      op: hover.value == null || hover.value === i ? 1 : 0.35,
      dl: i * 120,
    }
    c += pct
    return o
  })
  const h = hover.value
  return {
    segs,
    label: h == null ? centerLabel : items[h]!.label,
    value: money(h == null ? tot : items[h]!.value),
    sub: h == null ? `${items.length} categories` : segs[h]!.pct + ' of total',
  }
})

defineExpose({ replay })
</script>

<template>
  <KChartCard ref="card" :title="title" :index="index" :kind="kind" :k="theme.k">
    <div class="flex flex-wrap items-center gap-8">
      <div class="relative mx-auto aspect-square w-[220px] max-w-full flex-none">
        <svg viewBox="0 0 200 200" class="block size-full overflow-visible" aria-hidden="true">
          <circle cx="100" cy="100" r="78" fill="none" :stroke="CHART.track" stroke-width="20" />
          <g transform="rotate(-90 100 100)">
            <circle
              v-for="(s, i) in model.segs"
              :key="s.label"
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
          aria-live="polite"
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
          :key="s.label"
          :class="
            cn(
              'grid cursor-pointer grid-cols-[12px_minmax(0,1fr)_auto_40px] items-center gap-3 border-t border-line py-2 transition-opacity duration-(--duration-normal)',
            )
          "
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
