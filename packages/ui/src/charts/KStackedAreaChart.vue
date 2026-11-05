<script setup lang="ts">
import { computed, ref, useId } from 'vue'

import { useChartReveal, useChartTheme, type ChartSettings } from './context'
import KChartCard from './KChartCard.vue'
import KChartGrid from './KChartGrid.vue'
import KChartLegend from './KChartLegend.vue'
import { dur, f, MONTHS, smooth, type Pt } from './lib/scale'

const {
  names,
  rows,
  start,
  colorIndex,
  title = 'Asset mix over time',
  index,
  kind = '100% stacked area',
  ...settings
} = defineProps<
  {
    /** Series names, bottom layer first. */
    names: string[]
    /** One row per month; each row holds a percentage per series (summing to 100). */
    rows: number[][]
    /** Month of the first row. */
    start: Date
    /** Palette index per series (defaults to 0, 1, 2…). */
    colorIndex?: number[]
    title?: string
    index?: string
    kind?: string
  } & ChartSettings
>()

const card = ref()
const theme = useChartTheme(() => settings)
const { revealed, replay } = useChartReveal(card, () => theme.value.k)
const clipId = `k-stack-${useId()}`

const model = computed(() => {
  const L = 40
  const T = 8
  const iw = 472
  const ih = 204
  const n = rows.length
  const X = (i: number) => L + (i / (n - 1)) * iw
  const Y = (v: number) => T + (1 - v / 100) * ih
  const cum = rows.map((a) => {
    const c = [0]
    a.forEach((v) => c.push(c[c.length - 1]! + v))
    return c
  })
  const color = (k: number) => theme.value.P[colorIndex?.[k] ?? k]!
  const layers = names.map((_, k) => {
    const top: Pt[] = cum.map((c, i) => [X(i), Y(c[k + 1]!)])
    const bot: Pt[] = cum.map((c, i): Pt => [X(i), Y(c[k]!)]).reverse()
    return { d: smooth(top) + smooth(bot, ' L') + ' Z', c: color(k) }
  })
  // Evenly spaced whole-step marks plus the last point (24 months → 0, 6, 12, 18, 23).
  const stepM = Math.max(1, Math.round((n - 1) / 4))
  const marks = [0, stepM, stepM * 2, stepM * 3].filter((i) => i < n - 1).concat(n - 1)
  return {
    layers,
    legend: names.map((nm, k) => ({
      label: nm,
      color: color(k),
      value: Math.round(rows[n - 1]![k]!) + '%',
    })),
    grid: [0, 25, 50, 75, 100].map((v) => ({ y: f(Y(v)), ty: f(Y(v) + 4), label: v + '%' })),
    xl: marks.map((i, j) => {
      const d = new Date(start.getFullYear(), start.getMonth() + i, 1)
      return {
        x: f(X(i)),
        label: `${MONTHS[d.getMonth()]} ’${String(d.getFullYear()).slice(2)}`,
        anchor: j === 0 ? 'start' : j === marks.length - 1 ? 'end' : 'middle',
      }
    }),
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
      :aria-label="`${title}: ${model.legend.map((l) => `${l.label} ${l.value}`).join(', ')}`"
    >
      <defs>
        <clipPath :id="clipId">
          <rect
            x="40"
            y="0"
            width="472"
            height="240"
            :style="{
              transform: `scaleX(${revealed ? 1 : 0})`,
              transformBox: 'view-box',
              transformOrigin: '40px 0',
              transition: `transform ${dur(1400)} var(--ease-standard)`,
            }"
          />
        </clipPath>
      </defs>
      <g :clip-path="`url(#${clipId})`">
        <path
          v-for="(a, i) in model.layers"
          :key="i"
          :d="a.d"
          :fill="a.c"
          stroke="#fff"
          stroke-width="1.5"
        />
      </g>
      <KChartGrid :lines="model.grid" :x1="40" :x2="512" :label-x="32" labels-only />
      <text
        v-for="x in model.xl"
        :key="x.x"
        :x="x.x"
        y="232"
        :text-anchor="x.anchor"
        class="fill-fg-muted font-mono text-[11px]"
      >
        {{ x.label }}
      </text>
    </svg>
  </KChartCard>
</template>
