<script setup lang="ts">
import { computed, ref } from 'vue'

import { useChartReveal, useChartTheme, type ChartSettings } from './context'
import GChartCard from './GChartCard.vue'
import GChartGrid from './GChartGrid.vue'
import GChartLegend from './GChartLegend.vue'
import GStat from './GStat.vue'
import { CHART } from './lib/palette'
import { dur, f, gridOf, mk, money, ticks } from './lib/scale'

const {
  principal = 420000,
  rate = 0.0625,
  years = 30,
  title = 'Mortgage amortization',
  subtitle,
  ...settings
} = defineProps<
  {
    principal?: number
    rate?: number
    years?: number
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
  const iw = 432
  const ih = 220
  const rr = rate / 12
  const pay = (principal * rr) / (1 - Math.pow(1 + rr, -years * 12))
  let bal = principal
  const yrs: { pi: number; ii: number; bal: number }[] = []
  for (let y = 0; y < years; y++) {
    let pi = 0
    let ii = 0
    for (let m = 0; m < 12; m++) {
      const it = bal * rr
      const pr = pay - it
      ii += it
      pi += pr
      bal -= pr
    }
    yrs.push({ pi, ii, bal: Math.max(bal, 0) })
  }
  const tk = ticks(0, pay * 12, 4)
  const y1 = tk[tk.length - 1]!
  const Y = (v: number) => T + (1 - v / y1) * ih
  const step = iw / years
  const bw = step * 0.64
  const totI = yrs.reduce((a, d) => a + d.ii, 0)
  const h = hover.value
  const d = h == null ? null : yrs[h]!
  const marks = [1, Math.round(years / 3), Math.round((years * 2) / 3), years]
  return {
    cp: theme.value.P[0]!,
    ci: theme.value.mono ? theme.value.P[3]! : theme.value.P[2]!,
    grid: gridOf(tk, Y, mk),
    bars: yrs.map((d, i) => ({
      x: f(L + i * step + (step - bw) / 2),
      w: f(bw),
      hx: f(L + i * step),
      hw: f(step),
      yp: f(Y(d.pi)),
      hp: f((d.pi / y1) * ih),
      yi: f(Y(d.pi + d.ii)),
      hi: f((d.ii / y1) * ih),
      dl: i * 26,
      op: h == null || h === i ? 1 : 0.4,
    })),
    xl: marks.map((y) => ({ x: f(L + (y - 0.5) * step), label: `Yr ${y}` })),
    label:
      h == null
        ? `${mk(principal)} at ${(rate * 100).toFixed(2)}% · ${years} years`
        : `Year ${h + 1} · balance ${money(d!.bal)}`,
    value: h == null ? `${money(totI)} interest` : `${money(d!.pi + d!.ii)} paid`,
    split: h == null ? `${money(pay)}/mo` : `Principal ${money(d!.pi)} · Interest ${money(d!.ii)}`,
  }
})

defineExpose({ replay })
</script>

<template>
  <GChartCard ref="card" :title="title" :subtitle="subtitle" :k="theme.k">
    <div class="flex flex-wrap items-end justify-between gap-3">
      <GStat :label="model.label" :value="model.value" />
      <span class="text-footnote text-label-secondary tabular-nums">{{ model.split }}</span>
    </div>
    <svg
      viewBox="0 0 520 260"
      class="block h-auto w-full overflow-visible"
      role="img"
      :aria-label="`${title}: ${model.label}, ${model.value}`"
      @pointerleave="hover = null"
    >
      <GChartGrid :lines="model.grid" :x1="44" :x2="476" :label-x="36" :opacity="theme.gridOp" />
      <g
        v-for="(b, i) in model.bars"
        :key="i"
        class="cursor-pointer"
        :style="{
          opacity: b.op,
          transition: 'opacity var(--duration-normal) var(--ease-smooth)',
        }"
        @pointerenter="hover = i"
      >
        <rect :x="b.hx" y="12" :width="b.hw" height="220" fill="transparent" />
        <g
          :style="{
            transform: `scaleY(${revealed ? 1 : 0})`,
            transformBox: 'fill-box',
            transformOrigin: 'bottom',
            transition: `transform ${dur(600)} var(--ease-snappy) ${dur(b.dl)}`,
          }"
        >
          <rect :x="b.x" :y="b.yi" :width="b.w" :height="b.hi" rx="2" :fill="model.ci" />
          <rect :x="b.x" :y="b.yp" :width="b.w" :height="b.hp" rx="2" :fill="model.cp" />
        </g>
      </g>
      <text
        v-for="x in model.xl"
        :key="x.label"
        :x="x.x"
        y="252"
        text-anchor="middle"
        class="fill-label-secondary text-[11px] tabular-nums"
      >
        {{ x.label }}
      </text>
    </svg>
    <GChartLegend
      :items="[
        { label: 'Principal', color: model.cp },
        { label: 'Interest', color: model.ci },
      ]"
    />
  </GChartCard>
</template>
