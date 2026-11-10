<script setup lang="ts">
import { computed, useTemplateRef } from 'vue'

import { useChartReveal, useChartTheme, type ChartSettings } from './context'
import KChartCard from './KChartCard.vue'
import KChartGrid from './KChartGrid.vue'
import KStat from './KStat.vue'
import { CHART } from './lib/palette'
import { compactMoney, dur, gridOf, money, round1, ticks } from './lib/scale'

export interface WaterfallStep {
  label: string
  /** Positive = inflow, negative = outflow. */
  value: number
}

const {
  steps,
  totalLabel = 'Saved',
  statLabel = 'Saved this month',
  title = 'Income to savings',
  index,
  kind,
  showGrid = undefined,
  ...settings
} = defineProps<
  {
    steps: WaterfallStep[]
    totalLabel?: string
    statLabel?: string
    title?: string
    index?: string
    /** Short mono descriptor shown at the right of the header. */
    kind?: string
  } & ChartSettings
>()

const card = useTemplateRef<InstanceType<typeof KChartCard>>('card')
const theme = useChartTheme(() => ({ ...settings, showGrid }))
const { revealed, replay } = useChartReveal(card, () => theme.value.durationScale)

type BarType = 'in' | 'out' | 'net'

const model = computed(() => {
  let run = 0
  const bars: { name: string; value: number; from: number; to: number; type: BarType }[] = []
  steps.forEach((s) => {
    bars.push({
      name: s.label,
      value: s.value,
      from: run,
      to: run + s.value,
      type: s.value > 0 ? 'in' : 'out',
    })
    run += s.value
  })
  bars.push({ name: totalLabel, value: run, from: 0, to: run, type: 'net' })
  const income = steps.filter((s) => s.value > 0).reduce((a, s) => a + s.value, 0)
  const L = 44
  const T = 20
  const iw = 468
  const ih = 212
  // Outflows can take the running total below zero (a deficit month), so the domain includes it.
  const ends = bars.flatMap((b) => [b.from, b.to])
  const tk = ticks(Math.min(0, ...ends), Math.max(0, ...ends), 4)
  const y0 = tk[0]!
  const y1 = tk[tk.length - 1]!
  const Y = (value: number) => T + (1 - (value - y0) / (y1 - y0)) * ih
  const step = iw / bars.length
  const bw = step * 0.58
  const colour = (b: (typeof bars)[number]) => {
    if (b.type === 'in') return theme.value.series[0]!
    if (b.type === 'out') return theme.value.series[3]!
    return b.value >= 0 ? CHART.good : CHART.bad
  }
  return {
    total: money(run),
    positive: run >= 0,
    rate: income > 0 ? `${Math.round((run / income) * 100)}% of income` : undefined,
    grid: gridOf(tk, Y, compactMoney),
    bars: bars.map((b, i) => ({
      x: round1(L + i * step + (step - bw) / 2),
      w: round1(bw),
      y: round1(Y(Math.max(b.from, b.to))),
      h: round1(Math.abs(Y(b.from) - Y(b.to))),
      c: colour(b),
      // Each bar grows from where the running total was towards where it ends up.
      orig: b.to >= b.from ? 'bottom' : 'top',
      dl: i * 140,
      lx: round1(L + i * step + step / 2),
      ly: round1(Y(Math.max(b.from, b.to)) - 7),
      label: (b.type === 'in' ? '+' : '') + compactMoney(b.value),
      ld: i * 140 + 350,
      name: b.name,
    })),
    links: bars.slice(0, -1).map((b, i) => ({
      x1: round1(L + i * step + (step + bw) / 2),
      x2: round1(L + (i + 1) * step + (step - bw) / 2),
      y: round1(Y(b.to)),
      dl: i * 140 + 300,
    })),
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
    :empty="!steps.length"
  >
    <KStat
      :label="statLabel"
      :value="model.total"
      :delta="model.rate"
      :delta-tone="model.positive ? 'good' : 'bad'"
    />
    <svg
      viewBox="0 0 520 260"
      class="block h-auto w-full overflow-visible"
      role="img"
      :aria-label="`${title}: ${model.bars.map((b) => `${b.name} ${b.label}`).join(', ')}`"
    >
      <KChartGrid
        :lines="model.grid"
        :x1="44"
        :x2="512"
        :label-x="36"
        :opacity="theme.gridOpacity"
      />
      <line
        v-for="(l, i) in model.links"
        :key="i"
        :x1="l.x1"
        :x2="l.x2"
        :y1="l.y"
        :y2="l.y"
        :stroke="CHART.muted"
        stroke-dasharray="2 3"
        :style="{
          opacity: revealed ? 1 : 0,
          transition: `opacity ${dur(400)} var(--ease-standard) ${dur(l.dl)}`,
        }"
      />
      <g v-for="(b, i) in model.bars" :key="i">
        <rect
          :x="b.x"
          :y="b.y"
          :width="b.w"
          :height="b.h"
          rx="5"
          :fill="b.c"
          :style="{
            transform: `scaleY(${revealed ? 1 : 0})`,
            transformBox: 'fill-box',
            transformOrigin: b.orig,
            transition: `transform ${dur(600)} var(--ease-standard) ${dur(b.dl)}`,
          }"
        />
        <text
          :x="b.lx"
          :y="b.ly"
          text-anchor="middle"
          class="fill-fg font-mono text-[11px]"
          :style="{
            opacity: revealed ? 1 : 0,
            transition: `opacity ${dur(400)} var(--ease-standard) ${dur(b.ld)}`,
          }"
        >
          {{ b.label }}
        </text>
        <text :x="b.lx" y="252" text-anchor="middle" class="fill-fg-muted font-mono text-[11px]">
          {{ b.name }}
        </text>
      </g>
    </svg>
  </KChartCard>
</template>
