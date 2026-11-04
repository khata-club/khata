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
  title = 'Net cash flow',
  index,
  kind = 'Diverging column',
  ...settings
} = defineProps<
  {
    values: number[]
    months: string[]
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
  const tk = ticks(Math.min(0, ...values), Math.max(0, ...values), 5)
  const y0 = tk[0]!
  const y1 = tk[tk.length - 1]!
  const Y = (x: number) => T + (1 - (x - y0) / (y1 - y0)) * ih
  const z = Y(0)
  const step = iw / values.length
  const bw = step * 0.56
  const h = hover.value
  const val = h == null ? values.reduce((a, b) => a + b, 0) : values[h]!
  return {
    grid: gridOf(tk, Y, mk),
    zero: f(z),
    bars: values.map((x, i) => ({
      x: f(L + i * step + (step - bw) / 2),
      w: f(bw),
      hx: f(L + i * step),
      hw: f(step),
      y: f(x > 0 ? Y(x) : z),
      h: f(Math.abs(Y(x) - z)),
      c: x > 0 ? CHART.good : CHART.bad,
      orig: x > 0 ? 'bottom' : 'top',
      dl: i * 50,
      lx: f(L + i * step + step / 2),
      m: months[i]!.slice(0, 1),
      op: h == null || h === i ? 1 : 0.35,
    })),
    label: h == null ? `Net over ${values.length} months` : months[h]!,
    value: (val > 0 ? '+' : '') + money(val),
    positive: val >= 0,
  }
})

defineExpose({ replay })
</script>

<template>
  <KChartCard ref="card" :title="title" :index="index" :kind="kind" :k="theme.k">
    <KStat
      :label="model.label"
      :value="model.value"
      :value-class="model.positive ? 'text-success' : 'text-danger'"
    />
    <svg
      viewBox="0 0 520 240"
      class="block h-auto w-full overflow-visible"
      role="img"
      :aria-label="`${title}: ${model.label} ${model.value}`"
      @pointerleave="hover = null"
    >
      <KChartGrid :lines="model.grid" :x1="44" :x2="512" :label-x="36" :opacity="theme.gridOp" />
      <g
        v-for="(b, i) in model.bars"
        :key="i"
        class="cursor-pointer"
        :style="{
          opacity: b.op,
          transition: 'opacity var(--duration-normal) var(--ease-standard)',
        }"
        @pointerenter="hover = i"
      >
        <rect :x="b.hx" y="12" :width="b.hw" height="200" fill="transparent" />
        <rect
          :x="b.x"
          :y="b.y"
          :width="b.w"
          :height="b.h"
          rx="4"
          :fill="b.c"
          :style="{
            transform: `scaleY(${revealed ? 1 : 0})`,
            transformBox: 'fill-box',
            transformOrigin: b.orig,
            transition: `transform ${dur(650)} var(--ease-standard) ${dur(b.dl)}`,
          }"
        />
        <text :x="b.lx" y="230" text-anchor="middle" class="fill-fg-muted font-mono text-[11px]">
          {{ b.m }}
        </text>
      </g>
      <line
        x1="44"
        x2="512"
        :y1="model.zero"
        :y2="model.zero"
        :stroke="CHART.ink"
        stroke-width="1"
      />
    </svg>
  </KChartCard>
</template>
