<script setup lang="ts">
import { computed, useId, useTemplateRef } from 'vue'

import KSegmentedControl from '../components/KSegmentedControl.vue'
import { useChartReveal, useChartTheme, type ChartSettings } from './context'
import KChartCard from './KChartCard.vue'
import KChartGrid from './KChartGrid.vue'
import KChartLegend from './KChartLegend.vue'
import KStat from './KStat.vue'
import { CHART } from './lib/palette'
import {
  compactMoney,
  cssPath,
  dur,
  gridOf,
  money,
  round1,
  smooth,
  ticks,
  type Pt,
} from './lib/scale'

const {
  startBalance,
  startAge,
  endAge,
  growth = 0.06,
  volatility = 0.085,
  contributions,
  title = 'Retirement projection',
  index,
  kind,
  showGrid = undefined,
  ...settings
} = defineProps<
  {
    startBalance: number
    startAge: number
    endAge: number
    /** Expected annual return. */
    growth?: number
    /** Annual volatility used for the confidence bands. */
    volatility?: number
    /** Monthly contribution options. */
    contributions: number[]
    title?: string
    index?: string
    /** Short mono descriptor shown at the right of the header. */
    kind?: string
  } & ChartSettings
>()

/** Selected monthly contribution (defaults to the middle option). */
const contribution = defineModel<number>('contribution')
const selected = computed(
  () => contribution.value ?? contributions[Math.floor((contributions.length - 1) / 2)] ?? 0,
)
const years = computed(() => endAge - startAge)

const card = useTemplateRef<InstanceType<typeof KChartCard>>('card')
const theme = useChartTheme(() => ({ ...settings, showGrid }))
const { revealed, replay } = useChartReveal(card, () => theme.value.durationScale)
const clipId = `k-fan-${useId()}`

/** Yearly percentiles for a monthly contribution (lognormal bands around the median). */
const project = (monthly: number) => {
  const out = []
  for (let t = 0; t <= years.value; t++) {
    const g = Math.pow(1 + growth, t)
    // Future value of the contributions; with 0% growth they simply add up.
    const contributed = growth === 0 ? monthly * 12 * t : (monthly * 12 * (g - 1)) / growth
    const med = startBalance * g + contributed
    const sd = volatility * Math.sqrt(t)
    out.push({
      med,
      p10: med * Math.exp(-1.2816 * sd),
      p25: med * Math.exp(-0.674 * sd),
      p75: med * Math.exp(0.674 * sd),
      p90: med * Math.exp(1.2816 * sd),
      inv: startBalance + monthly * 12 * t,
    })
  }
  return out
}

const model = computed(() => {
  const L = 48
  const T = 12
  const iw = 460
  const ih = 220
  const n = years.value
  // Fixed y scale (largest option) so switching contribution visibly reshapes the fan.
  const tk = ticks(0, project(Math.max(...contributions))[n]!.p90, 4)
  const y1 = tk[tk.length - 1]!
  const X = (t: number) => L + (t / n) * iw
  const Y = (value: number) => T + (1 - value / y1) * ih
  const d = project(selected.value)
  type Key = 'med' | 'p10' | 'p25' | 'p75' | 'p90' | 'inv'
  const series = (key: Key): Pt[] => d.map((o, t) => [X(t), Y(o[key])])
  const bandD = (a: Key, b: Key) => smooth(series(a)) + smooth(series(b).reverse(), ' L') + ' Z'
  const marks = [0, 10, 20, 30, n].filter((t, i, a) => t <= n && a.indexOf(t) === i)
  return {
    outer: bandD('p90', 'p10'),
    inner: bandD('p75', 'p25'),
    line: smooth(series('med')),
    inv:
      'M' +
      series('inv')
        .map((p) => `${round1(p[0])},${round1(p[1])}`)
        .join(' L'),
    grid: gridOf(tk, Y, compactMoney),
    xl: marks.map((t, j) => ({
      x: round1(X(t)),
      label: `Age ${startAge + t}`,
      anchor: j === 0 ? 'start' : j === marks.length - 1 ? 'end' : 'middle',
    })),
    med: money(d[n]!.med),
    range: `80% range ${compactMoney(d[n]!.p10)}–${compactMoney(d[n]!.p90)}`,
  }
})

// Legend swatches matching the band fills (brand blue at the bands' opacities).
const BAND_INNER = `color-mix(in srgb, ${CHART.primary} 25%, transparent)`
const BAND_OUTER = `color-mix(in srgb, ${CHART.primary} 10%, transparent)`

const morph = (p: string) => ({ d: cssPath(p), transition: `d ${dur(700)} var(--ease-standard)` })

defineExpose({ replay })
</script>

<template>
  <KChartCard
    ref="card"
    :title="title"
    :index="index"
    :kind="kind"
    :duration-scale="theme.durationScale"
    :empty="!contributions.length || years < 1"
  >
    <div class="flex flex-wrap items-end justify-between gap-3">
      <KStat
        :label="`Median at ${endAge}`"
        :value="model.med"
        :delta="model.range"
        delta-tone="muted"
      />
      <KSegmentedControl
        :model-value="String(selected)"
        :options="contributions.map((c) => ({ value: String(c), label: `${money(c)}/mo` }))"
        label="Monthly contribution"
        size="sm"
        @update:model-value="$event && (contribution = Number($event))"
      />
    </div>
    <svg
      viewBox="0 0 520 260"
      class="block h-auto w-full overflow-visible"
      role="img"
      :aria-label="`${title}: median ${model.med} at ${endAge}, ${model.range}`"
    >
      <defs>
        <clipPath :id="clipId">
          <rect
            x="48"
            y="0"
            width="460"
            height="260"
            :style="{
              transform: `scaleX(${revealed ? 1 : 0})`,
              transformBox: 'view-box',
              transformOrigin: '48px 0',
              transition: `transform ${dur(1500)} var(--ease-standard)`,
            }"
          />
        </clipPath>
      </defs>
      <KChartGrid
        :lines="model.grid"
        :x1="48"
        :x2="508"
        :label-x="40"
        :opacity="theme.gridOpacity"
      />
      <text
        v-for="x in model.xl"
        :key="x.x"
        :x="x.x"
        y="252"
        :text-anchor="x.anchor"
        class="fill-fg-muted font-mono text-[11px]"
      >
        {{ x.label }}
      </text>
      <g :clip-path="`url(#${clipId})`">
        <path
          :d="model.outer"
          :fill="CHART.primary"
          fill-opacity="0.09"
          :style="morph(model.outer)"
        />
        <path
          :d="model.inner"
          :fill="CHART.primary"
          fill-opacity="0.16"
          :style="morph(model.inner)"
        />
        <path
          :d="model.inv"
          fill="none"
          :stroke="CHART.muted"
          stroke-width="1.5"
          stroke-dasharray="4 4"
          :style="morph(model.inv)"
        />
        <path
          :d="model.line"
          fill="none"
          :stroke="CHART.primary"
          stroke-width="2.5"
          stroke-linecap="round"
          :style="morph(model.line)"
        />
      </g>
    </svg>
    <KChartLegend
      :items="[
        { label: 'Median', color: CHART.primary, shape: 'line' },
        { label: '50% range', color: BAND_INNER, shape: 'band' },
        { label: '80% range', color: BAND_OUTER, shape: 'band' },
        { label: 'Contributed', color: CHART.muted, shape: 'dashed' },
      ]"
    />
  </KChartCard>
</template>
