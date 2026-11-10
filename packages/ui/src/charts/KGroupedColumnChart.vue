<script setup lang="ts">
import { computed, ref, useTemplateRef } from 'vue'

import { useChartReveal, useChartTheme, type ChartSettings } from './context'
import KChartCard from './KChartCard.vue'
import KChartGrid from './KChartGrid.vue'
import KChartLegend from './KChartLegend.vue'
import KStat from './KStat.vue'
import { compactMoney, dur, gridOf, money, round1, ticks } from './lib/scale'

const {
  months,
  income,
  expenses,
  title = 'Income vs expenses',
  index,
  kind,
  showGrid = undefined,
  ...settings
} = defineProps<
  {
    months: string[]
    income: number[]
    expenses: number[]
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
  const n = months.length
  const all = [...income, ...expenses]
  const tk = ticks(Math.min(0, ...all), Math.max(0, ...all), 4)
  const y0 = tk[0]!
  const y1 = tk[tk.length - 1]!
  const Y = (value: number) => T + (1 - (value - y0) / (y1 - y0)) * ih
  const top = (value: number) => round1(Y(Math.max(value, 0)))
  const height = (value: number) => round1(Math.abs(Y(value) - Y(0)))
  const step = iw / n
  const pw = step * 0.6
  const bw = (pw - 6) / 2
  const active = hover.value
  const sum = (list: number[]) => list.reduce((a, b) => a + b, 0)
  const totalSaved = sum(income) - sum(expenses)
  const saved = active == null ? totalSaved : (income[active] ?? 0) - (expenses[active] ?? 0)
  return {
    c1: theme.value.series[0]!,
    c2: theme.value.series[3]!,
    grid: gridOf(tk, Y, compactMoney),
    groups: months.map((m, i) => {
      const x0 = L + i * step + (step - pw) / 2
      return {
        m,
        hx: round1(L + i * step),
        hw: round1(step),
        x1: round1(x0),
        x2: round1(x0 + bw + 6),
        w: round1(bw),
        y1: top(income[i] ?? 0),
        h1: height(income[i] ?? 0),
        o1: (income[i] ?? 0) >= 0 ? 'bottom' : 'top',
        y2: top(expenses[i] ?? 0),
        h2: height(expenses[i] ?? 0),
        o2: (expenses[i] ?? 0) >= 0 ? 'bottom' : 'top',
        lx: round1(L + i * step + step / 2),
        dl: i * 90,
        op: active == null || active === i ? 1 : 0.4,
      }
    }),
    label:
      active == null
        ? `Saved over ${n} months`
        : `${months[active]} · ${money(income[active] ?? 0)} in, ${money(expenses[active] ?? 0)} out`,
    value: money(saved),
    summary: `${title}: ${n} months, ${money(sum(income))} in, ${money(sum(expenses))} out, ${money(totalSaved)} saved`,
  }
})

const grow = (on: boolean, delay: number, origin: string) => ({
  transform: `scaleY(${on ? 1 : 0})`,
  transformBox: 'fill-box' as const,
  transformOrigin: origin,
  transition: `transform ${dur(700)} var(--ease-standard) ${dur(delay)}`,
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
    :empty="!months.length"
  >
    <div class="flex flex-wrap items-end justify-between gap-3">
      <KStat :label="model.label" :value="model.value" />
      <KChartLegend
        :items="[
          { label: 'Income', color: model.c1 },
          { label: 'Expenses', color: model.c2 },
        ]"
      />
    </div>
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
        v-for="(b, i) in model.groups"
        :key="i"
        :style="{
          opacity: b.op,
          transition: 'opacity var(--duration-normal) var(--ease-standard)',
        }"
        @pointerenter="hover = i"
      >
        <rect :x="b.hx" y="12" :width="b.hw" height="200" fill="transparent" />
        <rect
          :x="b.x1"
          :y="b.y1"
          :width="b.w"
          :height="b.h1"
          rx="5"
          :fill="model.c1"
          :style="grow(revealed, b.dl, b.o1)"
        />
        <rect
          :x="b.x2"
          :y="b.y2"
          :width="b.w"
          :height="b.h2"
          rx="5"
          :fill="model.c2"
          :style="grow(revealed, b.dl + 70, b.o2)"
        />
        <text :x="b.lx" y="230" text-anchor="middle" class="fill-fg-muted font-mono text-[11px]">
          {{ b.m }}
        </text>
      </g>
    </svg>
  </KChartCard>
</template>
