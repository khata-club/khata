<script setup lang="ts">
import { computed, ref } from 'vue'

import { useChartReveal, useChartTheme, type ChartSettings } from './context'
import GChartCard from './GChartCard.vue'
import GChartGrid from './GChartGrid.vue'
import GChartLegend from './GChartLegend.vue'
import GStat from './GStat.vue'
import { dur, f, gridOf, mk, money, ticks } from './lib/scale'

const {
  months,
  income,
  expenses,
  title = 'Income vs expenses',
  subtitle,
  ...settings
} = defineProps<
  {
    months: string[]
    income: number[]
    expenses: number[]
    title?: string
    /** Quiet line under the title. */
    subtitle?: string
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
  const n = months.length
  const tk = ticks(0, Math.max(...income, ...expenses), 4)
  const y1 = tk[tk.length - 1]!
  const Y = (x: number) => T + (1 - x / y1) * ih
  const step = iw / n
  const pw = step * 0.6
  const bw = (pw - 6) / 2
  const h = hover.value
  const sum = (a: number[]) => a.reduce((x, y) => x + y, 0)
  const saved = h == null ? sum(income) - sum(expenses) : income[h]! - expenses[h]!
  return {
    c1: theme.value.P[0]!,
    c2: theme.value.P[3]!,
    grid: gridOf(tk, Y, mk),
    groups: months.map((m, i) => {
      const x0 = L + i * step + (step - pw) / 2
      return {
        m,
        hx: f(L + i * step),
        hw: f(step),
        x1: f(x0),
        x2: f(x0 + bw + 6),
        w: f(bw),
        y1: f(Y(income[i]!)),
        h1: f((income[i]! / y1) * ih),
        y2: f(Y(expenses[i]!)),
        h2: f((expenses[i]! / y1) * ih),
        lx: f(L + i * step + step / 2),
        dl: i * 90,
        op: h == null || h === i ? 1 : 0.4,
      }
    }),
    label:
      h == null
        ? `Saved over ${n} months`
        : `${months[h]} · ${money(income[h]!)} in, ${money(expenses[h]!)} out`,
    value: money(saved),
  }
})

const grow = (on: boolean, delay: number) => ({
  transform: `scaleY(${on ? 1 : 0})`,
  transformBox: 'fill-box' as const,
  transformOrigin: 'bottom',
  transition: `transform ${dur(700)} var(--ease-snappy) ${dur(delay)}`,
})

defineExpose({ replay })
</script>

<template>
  <GChartCard ref="card" :title="title" :subtitle="subtitle" :k="theme.k">
    <div class="flex flex-wrap items-end justify-between gap-3">
      <GStat :label="model.label" :value="model.value" />
      <GChartLegend
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
      :aria-label="`${title}: ${model.label} ${model.value}`"
      @pointerleave="hover = null"
    >
      <GChartGrid :lines="model.grid" :x1="44" :x2="512" :label-x="36" :opacity="theme.gridOp" />
      <g
        v-for="(b, i) in model.groups"
        :key="b.m"
        :style="{
          opacity: b.op,
          transition: 'opacity var(--duration-normal) var(--ease-smooth)',
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
          :style="grow(revealed, b.dl)"
        />
        <rect
          :x="b.x2"
          :y="b.y2"
          :width="b.w"
          :height="b.h2"
          rx="5"
          :fill="model.c2"
          :style="grow(revealed, b.dl + 70)"
        />
        <text
          :x="b.lx"
          y="230"
          text-anchor="middle"
          class="fill-label-secondary text-[11px] tabular-nums"
        >
          {{ b.m }}
        </text>
      </g>
    </svg>
  </GChartCard>
</template>
