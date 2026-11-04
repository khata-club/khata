<script setup lang="ts">
import { computed, ref } from 'vue'

import { useChartReveal, useChartTheme, type ChartSettings } from './context'
import KChartCard from './KChartCard.vue'
import KChartGrid from './KChartGrid.vue'
import KChartLegend from './KChartLegend.vue'
import { dur, f, gridOf, mk, ticks } from './lib/scale'

const {
  names,
  months,
  rows,
  title = 'Category mix by month',
  index,
  kind = 'Stacked column',
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
    kind?: string
  } & ChartSettings
>()

const card = ref()
const theme = useChartTheme(() => settings)
const { revealed, replay } = useChartReveal(card, () => theme.value.k)

const model = computed(() => {
  const L = 44
  const T = 12
  const iw = 468
  const ih = 200
  const tk = ticks(0, Math.max(...rows.map((a) => a.reduce((s, v) => s + v, 0))), 4)
  const y1 = tk[tk.length - 1]!
  const Y = (x: number) => T + (1 - x / y1) * ih
  const step = iw / months.length
  const bw = step * 0.5
  const segs: { x: number; y: number; w: number; h: number; c: string; dl: number }[] = []
  rows.forEach((a, i) => {
    let cu = 0
    a.forEach((v, k) => {
      segs.push({
        x: f(L + i * step + (step - bw) / 2),
        y: f(Y(cu + v)),
        w: f(bw),
        h: f((v / y1) * ih - 2),
        c: theme.value.P[k]!,
        dl: i * 50 + k * 160,
      })
      cu += v
    })
  })
  return {
    segs,
    grid: gridOf(tk, Y, mk),
    legend: names.map((n, k) => ({ label: n, color: theme.value.P[k]! })),
    xl: months.map((m, i) => ({ m, x: f(L + i * step + step / 2) })),
  }
})

defineExpose({ replay })
</script>

<template>
  <KChartCard ref="card" :title="title" :index="index" :kind="kind" :k="theme.k">
    <KChartLegend :items="model.legend" />
    <svg
      viewBox="0 0 520 240"
      class="block h-auto w-full overflow-visible"
      role="img"
      :aria-label="`${title} for ${months.join(', ')}`"
    >
      <KChartGrid :lines="model.grid" :x1="44" :x2="512" :label-x="36" :opacity="theme.gridOp" />
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
        v-for="x in model.xl"
        :key="x.m"
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
