<script setup lang="ts">
import { computed, ref } from 'vue'

import { useChartReveal, useChartTheme, type ChartSettings } from './context'
import KChartCard from './KChartCard.vue'
import KChartGrid from './KChartGrid.vue'
import KStat from './KStat.vue'
import { CHART } from './lib/palette'
import { dur, f, gridOf, mk, money, ticks } from './lib/scale'

const {
  values,
  months,
  years,
  title = 'Monthly spending',
  index,
  kind = 'Column · average line',
  ...settings
} = defineProps<
  {
    values: number[]
    /** Short month names, one per value. */
    months: string[]
    /** Year per value (for the read-out). */
    years?: number[]
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
  const L = 44
  const T = 12
  const iw = 468
  const ih = 200
  const n = values.length
  const tk = ticks(0, Math.max(...values), 5)
  const y1 = tk[tk.length - 1]!
  const Y = (x: number) => T + (1 - x / y1) * ih
  const step = iw / n
  const bw = step * 0.56
  const avg = values.reduce((a, b) => a + b, 0) / n
  const a = hover.value ?? n - 1
  const diff = ((values[a]! - avg) / avg) * 100
  return {
    grid: gridOf(tk, Y, mk),
    bars: values.map((x, i) => ({
      x: f(L + i * step + (step - bw) / 2),
      w: f(bw),
      hx: f(L + i * step),
      hw: f(step),
      y: f(Y(x)),
      h: f((x / y1) * ih),
      c: i === a ? theme.value.P[0]! : CHART.light,
      dl: i * 45,
      lx: f(L + i * step + step / 2),
      m: months[i]!.slice(0, 1),
    })),
    avgY: f(Y(avg)),
    avgLabel: `avg ${mk(avg)}`,
    label: years ? `${months[a]} ${years[a]}` : months[a]!,
    value: money(values[a]!),
    vs: `${diff >= 0 ? '+' : '−'}${Math.abs(diff).toFixed(1)}% vs average`,
    over: diff > 0,
  }
})

defineExpose({ replay })
</script>

<template>
  <KChartCard ref="card" :title="title" :index="index" :kind="kind" :k="theme.k">
    <KStat
      :label="model.label"
      :value="model.value"
      :delta="model.vs"
      :delta-tone="model.over ? 'bad' : 'good'"
    />
    <svg
      viewBox="0 0 520 240"
      class="block h-auto w-full overflow-visible"
      role="img"
      :aria-label="`${title}, ${model.label}: ${model.value}`"
      @pointerleave="hover = null"
    >
      <KChartGrid :lines="model.grid" :x1="44" :x2="512" :label-x="36" :opacity="theme.gridOp" />
      <g v-for="(b, i) in model.bars" :key="i" class="cursor-pointer" @pointerenter="hover = i">
        <rect :x="b.hx" y="12" :width="b.hw" height="200" fill="transparent" />
        <rect
          :x="b.x"
          :y="b.y"
          :width="b.w"
          :height="b.h"
          rx="6"
          :fill="b.c"
          :style="{
            transform: `scaleY(${revealed ? 1 : 0})`,
            transformBox: 'fill-box',
            transformOrigin: 'bottom',
            transition: `transform ${dur(700)} var(--ease-standard) ${dur(b.dl)}, fill var(--duration-normal) var(--ease-standard)`,
          }"
        />
        <text :x="b.lx" y="230" text-anchor="middle" class="fill-fg-muted font-mono text-[11px]">
          {{ b.m }}
        </text>
      </g>
      <g
        class="pointer-events-none"
        :style="{
          opacity: revealed ? 1 : 0,
          transition: `opacity ${dur(600)} var(--ease-standard) ${dur(900)}`,
        }"
      >
        <line
          x1="44"
          x2="512"
          :y1="model.avgY"
          :y2="model.avgY"
          :stroke="CHART.ink"
          stroke-width="1.25"
          stroke-dasharray="4 4"
        />
        <text x="512" :y="model.avgY - 6" text-anchor="end" class="fill-fg font-mono text-[11px]">
          {{ model.avgLabel }}
        </text>
      </g>
    </svg>
  </KChartCard>
</template>
