<script setup lang="ts">
import { computed, ref, useTemplateRef } from 'vue'

import { useChartReveal, useChartTheme, type ChartSettings } from './context'
import KChartCard from './KChartCard.vue'
import KChartGrid from './KChartGrid.vue'
import KStat from './KStat.vue'
import { CHART } from './lib/palette'
import { compactMoney, dur, gridOf, money, round1, ticks } from './lib/scale'

const {
  values,
  months,
  title = 'Net cash flow',
  index,
  kind,
  showGrid = undefined,
  ...settings
} = defineProps<
  {
    values: number[]
    months: string[]
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
  const tk = ticks(Math.min(0, ...values), Math.max(0, ...values), 5)
  const y0 = tk[0]!
  const y1 = tk[tk.length - 1]!
  const Y = (value: number) => T + (1 - (value - y0) / (y1 - y0)) * ih
  const zeroY = Y(0)
  const step = iw / values.length
  const bw = step * 0.56
  const active = hover.value
  const net = values.reduce((a, b) => a + b, 0)
  const val = active == null ? net : (values[active] ?? 0)
  return {
    grid: gridOf(tk, Y, compactMoney),
    zero: round1(zeroY),
    // Zero counts as positive everywhere (bar colour, read-out colour, sign).
    bars: values.map((value, i) => ({
      x: round1(L + i * step + (step - bw) / 2),
      w: round1(bw),
      hx: round1(L + i * step),
      hw: round1(step),
      y: round1(value >= 0 ? Y(value) : zeroY),
      h: round1(Math.abs(Y(value) - zeroY)),
      c: value >= 0 ? CHART.good : CHART.bad,
      orig: value >= 0 ? 'bottom' : 'top',
      dl: i * 50,
      lx: round1(L + i * step + step / 2),
      m: (months[i] ?? '').slice(0, 1),
      op: active == null || active === i ? 1 : 0.35,
    })),
    label: active == null ? `Net over ${values.length} months` : (months[active] ?? ''),
    value: (val > 0 ? '+' : '') + money(val),
    positive: val >= 0,
    summary: `${title}: net ${money(net)} over ${values.length} months, ${
      values.filter((v) => v < 0).length
    } in deficit`,
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
      :value-class="model.positive ? 'text-success' : 'text-danger'"
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
