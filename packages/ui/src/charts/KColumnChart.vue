<script setup lang="ts">
import { computed, ref, useTemplateRef } from 'vue'

import { useChartReveal, useChartTheme, type ChartSettings } from './context'
import KChartCard from './KChartCard.vue'
import KChartGrid from './KChartGrid.vue'
import KStat from './KStat.vue'
import { CHART } from './lib/palette'
import { compactMoney, dur, gridOf, money, pct, pctChange, round1, ticks } from './lib/scale'

const {
  values,
  months,
  years,
  title = 'Monthly spending',
  index,
  kind,
  showGrid = undefined,
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
    /** Short mono descriptor shown at the right of the header. */
    kind?: string
  } & ChartSettings
>()

const card = useTemplateRef<InstanceType<typeof KChartCard>>('card')
const theme = useChartTheme(() => ({ ...settings, showGrid }))
const { revealed, replay } = useChartReveal(card, () => theme.value.durationScale)
const hover = ref<number | null>(null)

const model = computed(() => {
  const L = 44
  const T = 12
  const iw = 468
  const ih = 200
  const n = values.length
  // Zero-baseline scale: net-worth style data can go negative.
  const tk = ticks(Math.min(0, ...values), Math.max(0, ...values), 5)
  const y0 = tk[0]!
  const y1 = tk[tk.length - 1]!
  const Y = (value: number) => T + (1 - (value - y0) / (y1 - y0)) * ih
  const step = iw / n
  const bw = step * 0.56
  const avg = values.reduce((a, b) => a + b, 0) / n
  const active = hover.value ?? n - 1
  const diff = pctChange(avg, values[active]!)
  return {
    grid: gridOf(tk, Y, compactMoney),
    bars: values.map((value, i) => ({
      x: round1(L + i * step + (step - bw) / 2),
      w: round1(bw),
      hx: round1(L + i * step),
      hw: round1(step),
      y: round1(Y(Math.max(value, 0))),
      h: round1(Math.abs(Y(value) - Y(0))),
      // Bars grow away from the zero line.
      origin: value >= 0 ? 'bottom' : 'top',
      c: i === active ? theme.value.series[0]! : CHART.light,
      dl: i * 45,
      lx: round1(L + i * step + step / 2),
      m: (months[i] ?? '').slice(0, 1),
    })),
    avgY: round1(Y(avg)),
    avgLabel: `avg ${compactMoney(avg)}`,
    label: years ? `${months[active]} ${years[active]}` : (months[active] ?? ''),
    value: money(values[active]!),
    vs: diff === null ? undefined : `${pct(diff)} vs average`,
    over: (diff ?? 0) > 0,
    summary: `${title}: ${n} months, latest ${money(values[n - 1]!)}, average ${money(avg)}`,
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
    :empty="!values.length"
  >
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
      :aria-label="model.summary"
      @pointerleave="hover = null"
    >
      <KChartGrid
        :lines="model.grid"
        :x1="44"
        :x2="512"
        :label-x="36"
        :opacity="theme.gridOpacity"
      />
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
            transformOrigin: b.origin,
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
