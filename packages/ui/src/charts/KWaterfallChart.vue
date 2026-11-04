<script setup lang="ts">
import { computed, ref } from 'vue'

import { useChartReveal, useChartTheme, type ChartSettings } from './context'
import KChartCard from './KChartCard.vue'
import KChartGrid from './KChartGrid.vue'
import KStat from './KStat.vue'
import { CHART } from './lib/palette'
import { dur, f, gridOf, mk, money, ticks } from './lib/scale'

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
  kind = 'Waterfall',
  ...settings
} = defineProps<
  {
    steps: WaterfallStep[]
    totalLabel?: string
    statLabel?: string
    title?: string
    index?: string
    kind?: string
  } & ChartSettings
>()

const card = ref()
const theme = useChartTheme(() => settings)
const { revealed, replay } = useChartReveal(card, () => theme.value.k)

const model = computed(() => {
  let run = 0
  const bars: { n: string; v: number; a: number; b: number; kind: 'in' | 'out' | 'net' }[] = []
  steps.forEach((s) => {
    bars.push({
      n: s.label,
      v: s.value,
      a: run,
      b: run + s.value,
      kind: s.value > 0 ? 'in' : 'out',
    })
    run += s.value
  })
  bars.push({ n: totalLabel, v: run, a: 0, b: run, kind: 'net' })
  const income = steps.filter((s) => s.value > 0).reduce((a, s) => a + s.value, 0)
  const L = 44
  const T = 20
  const iw = 468
  const ih = 212
  const tk = ticks(0, Math.max(...bars.map((b) => Math.max(b.a, b.b))), 4)
  const y1 = tk[tk.length - 1]!
  const Y = (v: number) => T + (1 - v / y1) * ih
  const step = iw / bars.length
  const bw = step * 0.58
  return {
    total: money(run),
    rate: `${Math.round((run / income) * 100)}% of income`,
    grid: gridOf(tk, Y, mk),
    bars: bars.map((b, i) => ({
      x: f(L + i * step + (step - bw) / 2),
      w: f(bw),
      y: f(Y(Math.max(b.a, b.b))),
      h: f(Math.abs(Y(b.a) - Y(b.b))),
      c: b.kind === 'in' ? theme.value.P[0]! : b.kind === 'out' ? theme.value.P[3]! : CHART.good,
      orig: b.kind === 'out' ? 'top' : 'bottom',
      dl: i * 140,
      lx: f(L + i * step + step / 2),
      ly: f(Y(Math.max(b.a, b.b)) - 7),
      label: (b.kind === 'in' ? '+' : '') + mk(b.v),
      ld: i * 140 + 350,
      name: b.n,
    })),
    links: bars.slice(0, -1).map((b, i) => ({
      x1: f(L + i * step + (step + bw) / 2),
      x2: f(L + (i + 1) * step + (step - bw) / 2),
      y: f(Y(b.b)),
      dl: i * 140 + 300,
    })),
  }
})

defineExpose({ replay })
</script>

<template>
  <KChartCard ref="card" :title="title" :index="index" :kind="kind" :k="theme.k">
    <KStat :label="statLabel" :value="model.total" :delta="model.rate" delta-tone="good" />
    <svg
      viewBox="0 0 520 260"
      class="block h-auto w-full overflow-visible"
      role="img"
      :aria-label="`${title}: ${model.bars.map((b) => `${b.name} ${b.label}`).join(', ')}`"
    >
      <KChartGrid :lines="model.grid" :x1="44" :x2="512" :label-x="36" :opacity="theme.gridOp" />
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
      <g v-for="b in model.bars" :key="b.name">
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
