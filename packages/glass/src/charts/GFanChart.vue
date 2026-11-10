<script setup lang="ts">
import { computed, ref, useId } from 'vue'

import GSegmentedControl from '../components/GSegmentedControl.vue'
import { useChartReveal, useChartTheme, type ChartSettings } from './context'
import GChartCard from './GChartCard.vue'
import GChartGrid from './GChartGrid.vue'
import GChartLegend from './GChartLegend.vue'
import GStat from './GStat.vue'
import { CHART } from './lib/palette'
import { cssPath, dur, f, gridOf, mk, money, smooth, ticks, type Pt } from './lib/scale'

const {
  startBalance = 86940,
  startAge = 35,
  endAge = 70,
  growth = 0.06,
  volatility = 0.085,
  contributions = [500, 1000, 2000],
  title = 'Retirement projection',
  subtitle,
  ...settings
} = defineProps<
  {
    startBalance?: number
    startAge?: number
    endAge?: number
    /** Expected annual return. */
    growth?: number
    /** Annual volatility used for the confidence bands. */
    volatility?: number
    /** Monthly contribution options. */
    contributions?: number[]
    title?: string
    /** Quiet line under the title. */
    subtitle?: string
  } & ChartSettings
>()

/** Selected monthly contribution. */
const contribution = defineModel<number>('contribution', { default: 1000 })

const card = ref()
const theme = useChartTheme(() => settings)
const { revealed, replay } = useChartReveal(card, () => theme.value.k)
const clipId = `k-fan-${useId()}`

const calc = (c: number) => {
  const n = endAge - startAge
  const out = []
  for (let t = 0; t <= n; t++) {
    const g = Math.pow(1 + growth, t)
    const med = startBalance * g + (c * 12 * (g - 1)) / growth
    const sd = volatility * Math.sqrt(t)
    out.push({
      med,
      p10: med * Math.exp(-1.2816 * sd),
      p25: med * Math.exp(-0.674 * sd),
      p75: med * Math.exp(0.674 * sd),
      p90: med * Math.exp(1.2816 * sd),
      inv: startBalance + c * 12 * t,
    })
  }
  return out
}

const model = computed(() => {
  const L = 48
  const T = 12
  const iw = 460
  const ih = 220
  const n = endAge - startAge
  // Fixed y scale (largest option) so switching contribution visibly reshapes the fan.
  const tk = ticks(0, calc(Math.max(...contributions))[n]!.p90, 4)
  const y1 = tk[tk.length - 1]!
  const X = (t: number) => L + (t / n) * iw
  const Y = (v: number) => T + (1 - v / y1) * ih
  const d = calc(contribution.value)
  type Key = 'med' | 'p10' | 'p25' | 'p75' | 'p90' | 'inv'
  const P2 = (key: Key): Pt[] => d.map((o, t) => [X(t), Y(o[key])])
  const bandD = (a: Key, b: Key) => smooth(P2(a)) + smooth(P2(b).reverse(), ' L') + ' Z'
  const marks = [0, 10, 20, 30, n].filter((t, i, a) => t <= n && a.indexOf(t) === i)
  return {
    outer: bandD('p90', 'p10'),
    inner: bandD('p75', 'p25'),
    line: smooth(P2('med')),
    inv:
      'M' +
      P2('inv')
        .map((p) => `${f(p[0])},${f(p[1])}`)
        .join(' L'),
    grid: gridOf(tk, Y, mk),
    xl: marks.map((t, j) => ({
      x: f(X(t)),
      label: `Age ${startAge + t}`,
      anchor: j === 0 ? 'start' : j === marks.length - 1 ? 'end' : 'middle',
    })),
    med: money(d[n]!.med),
    range: `80% range ${mk(d[n]!.p10)}–${mk(d[n]!.p90)}`,
  }
})

const morph = (p: string) => ({ d: cssPath(p), transition: `d ${dur(700)} var(--ease-smooth)` })

defineExpose({ replay })
</script>

<template>
  <GChartCard ref="card" :title="title" :subtitle="subtitle" :k="theme.k">
    <div class="flex flex-wrap items-end justify-between gap-3">
      <GStat
        :label="`Median at ${endAge}`"
        :value="model.med"
        :delta="model.range"
        delta-tone="muted"
      />
      <GSegmentedControl
        :model-value="String(contribution)"
        :options="
          contributions.map((c) => ({
            value: String(c),
            label: `$${c.toLocaleString('en-US')}/mo`,
          }))
        "
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
              transition: `transform ${dur(1500)} var(--ease-smooth)`,
            }"
          />
        </clipPath>
      </defs>
      <GChartGrid :lines="model.grid" :x1="48" :x2="508" :label-x="40" :opacity="theme.gridOp" />
      <text
        v-for="x in model.xl"
        :key="x.x"
        :x="x.x"
        y="252"
        :text-anchor="x.anchor"
        class="fill-label-secondary text-[11px] tabular-nums"
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
    <GChartLegend
      :items="[
        { label: 'Median', color: CHART.primary, shape: 'line' },
        {
          label: '50% range',
          color: 'color-mix(in srgb, var(--color-series-1) 28%, transparent)',
          shape: 'band',
        },
        {
          label: '80% range',
          color: 'color-mix(in srgb, var(--color-series-1) 12%, transparent)',
          shape: 'band',
        },
        { label: 'Contributed', color: CHART.muted, shape: 'dashed' },
      ]"
    />
  </GChartCard>
</template>
