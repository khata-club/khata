<script setup lang="ts">
import { computed, useTemplateRef } from 'vue'

import { useChartReveal, useChartTheme, type ChartSettings } from './context'
import KChartCard from './KChartCard.vue'
import KChartGrid from './KChartGrid.vue'
import KChartLegend from './KChartLegend.vue'
import { seriesColor } from './lib/palette'
import { compactMoney, dur, gridOf, money, round1, ticks } from './lib/scale'

const {
  names,
  months,
  rows,
  title = 'Category mix by month',
  index,
  kind,
  showGrid = undefined,
  ...settings
} = defineProps<
  {
    /** Series names, bottom of the stack first. */
    names: string[]
    months: string[]
    /** One row per month with a value per series. */
    rows: number[][]
    title?: string
    index?: string
    /** Short mono descriptor shown at the right of the header. */
    kind?: string
  } & ChartSettings
>()

const card = useTemplateRef<InstanceType<typeof KChartCard>>('card')
const theme = useChartTheme(() => ({ ...settings, showGrid }))
const { revealed, replay } = useChartReveal(card, () => theme.value.durationScale)

const model = computed(() => {
  const L = 44
  const T = 12
  const iw = 468
  const ih = 200
  const totals = rows.map((row) => row.reduce((sum, v) => sum + v, 0))
  const tk = ticks(0, Math.max(0, ...totals), 4)
  const y1 = tk[tk.length - 1]!
  const Y = (value: number) => T + (1 - value / y1) * ih
  const step = iw / months.length
  const bw = step * 0.5
  const segs: { x: number; y: number; w: number; h: number; c: string; dl: number }[] = []
  rows.forEach((row, i) => {
    let below = 0
    row.forEach((v, k) => {
      segs.push({
        x: round1(L + i * step + (step - bw) / 2),
        y: round1(Y(below + v)),
        w: round1(bw),
        // 2px gap between segments; a segment smaller than the gap draws nothing.
        h: round1(Math.max(0, (v / y1) * ih - 2)),
        c: seriesColor(theme.value.series, k),
        dl: i * 50 + k * 160,
      })
      below += v
    })
  })
  return {
    segs,
    grid: gridOf(tk, Y, compactMoney),
    legend: names.map((name, k) => ({ label: name, color: seriesColor(theme.value.series, k) })),
    xl: months.map((m, i) => ({ m, x: round1(L + i * step + step / 2) })),
    summary: `${title}: ${months.map((m, i) => `${m} ${money(totals[i] ?? 0)}`).join(', ')}`,
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
    :empty="!rows.length"
  >
    <KChartLegend :items="model.legend" />
    <svg
      viewBox="0 0 520 240"
      class="block h-auto w-full overflow-visible"
      role="img"
      :aria-label="model.summary"
    >
      <KChartGrid
        :lines="model.grid"
        :x1="44"
        :x2="512"
        :label-x="36"
        :opacity="theme.gridOpacity"
      />
      <rect
        v-for="(b, i) in model.segs"
        :key="i"
        :x="b.x"
        :y="b.y"
        :width="b.w"
        :height="b.h"
        rx="3"
        :fill="b.c"
        :style="{
          transform: `scaleY(${revealed ? 1 : 0})`,
          transformBox: 'fill-box',
          transformOrigin: 'bottom',
          transition: `transform ${dur(500)} var(--ease-standard) ${dur(b.dl)}`,
        }"
      />
      <text
        v-for="(x, i) in model.xl"
        :key="i"
        :x="x.x"
        y="230"
        text-anchor="middle"
        class="fill-fg-muted font-mono text-[11px]"
      >
        {{ x.m }}
      </text>
    </svg>
  </KChartCard>
</template>
