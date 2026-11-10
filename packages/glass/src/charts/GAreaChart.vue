<script setup lang="ts">
import { computed, ref, useId } from 'vue'

import GSegmentedControl from '../components/GSegmentedControl.vue'
import { useChartReveal, useChartTheme, type ChartSettings } from './context'
import GChartCard from './GChartCard.vue'
import GChartGrid from './GChartGrid.vue'
import GStat from './GStat.vue'
import { CHART } from './lib/palette'
import { cssPath, dur, f, gridOf, MONTHS, mk, money, smooth, ticks } from './lib/scale'

const {
  values,
  end,
  ranges = { '6M': 26, '1Y': 52, '3Y': 156, '5Y': 260 },
  title = 'Net worth',
  subtitle,
  ...settings
} = defineProps<
  {
    /** One value per week, oldest first. */
    values: number[]
    /** Date of the last value. */
    end: Date
    /** Range label → number of weeks shown. */
    ranges?: Record<string, number>
    title?: string
    /** Quiet line under the title. */
    subtitle?: string
  } & ChartSettings
>()

/** Selected range key. */
const range = defineModel<string>('range', { default: '1Y' })

const card = ref()
const theme = useChartTheme(() => settings)
const { revealed, replay } = useChartReveal(card, () => theme.value.k)
const gid = `k-area-${useId()}`
const hover = ref<number | null>(null)

// Plot on the left, y labels trailing on the right (as in Stocks).
const W = { L: 8, T: 16, iw: 912, ih: 252, N: 52 }

const model = computed(() => {
  const { L, T, iw, ih, N } = W
  const total = values.length
  const span = Math.min(ranges[range.value] ?? 52, total)
  const off = total - span
  const pts = [...Array(N)].map((_, i) => {
    const x = off + (i / (N - 1)) * (span - 1)
    const a = Math.floor(x)
    const b = Math.min(a + 1, total - 1)
    return { v: values[a]! + (values[b]! - values[a]!) * (x - a), w: x }
  })
  const lo = Math.min(...pts.map((p) => p.v))
  const hi = Math.max(...pts.map((p) => p.v))
  const tk = ticks(lo - (hi - lo) * 0.1, hi, 4)
  const y0 = tk[0]!
  const y1 = tk[tk.length - 1]!
  const X = (i: number) => L + (i / (N - 1)) * iw
  const Y = (v: number) => T + (1 - (v - y0) / (y1 - y0)) * ih
  const line = smooth(pts.map((p, i) => [X(i), Y(p.v)]))
  const area = line + ` L${L + iw},${T + ih} L${L},${T + ih} Z`
  const date = (w: number) => {
    const d = new Date(end)
    d.setDate(d.getDate() - Math.round(total - 1 - w) * 7)
    return d
  }
  const keys = Object.keys(ranges)
  const lab = (d: Date) =>
    range.value === keys[0]
      ? `${MONTHS[d.getMonth()]} ${d.getDate()}`
      : span <= 52
        ? MONTHS[d.getMonth()]!
        : `${MONTHS[d.getMonth()]} ’${String(d.getFullYear()).slice(2)}`
  const h = hover.value
  const cur = h == null ? pts[N - 1]! : pts[h]!
  const dv = cur.v - pts[0]!.v
  const pc = (dv / pts[0]!.v) * 100
  const d = date(cur.w)
  return {
    line,
    area,
    grid: gridOf(tk, Y, mk),
    xl: [0, 1, 2, 3, 4, 5].map((j) => {
      const i = Math.round((j * (N - 1)) / 5)
      return {
        x: f(X(i)),
        label: lab(date(pts[i]!.w)),
        anchor: j === 0 ? 'start' : j === 5 ? 'end' : 'middle',
      }
    }),
    value: money(cur.v),
    when: h == null ? 'Today' : `${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`,
    delta: `${dv >= 0 ? '+' : '−'}${money(Math.abs(dv))} · ${dv >= 0 ? '+' : '−'}${Math.abs(pc).toFixed(1)}% over ${range.value}`,
    good: dv >= 0,
    ex: f(X(N - 1)),
    ey: f(Y(pts[N - 1]!.v)),
    hx: h == null ? 0 : f(X(h)),
    hy: h == null ? 0 : f(Y(cur.v)),
  }
})

function move(e: PointerEvent) {
  const b = (e.currentTarget as Element).getBoundingClientRect()
  const i = Math.max(0, Math.min(W.N - 1, Math.round(((e.clientX - b.left) / b.width) * (W.N - 1))))
  if (i !== hover.value) hover.value = i
}
function pickRange(r: string | undefined) {
  if (!r) return
  range.value = r
  hover.value = null
}

defineExpose({ replay })
</script>

<template>
  <GChartCard ref="card" :title="title" :subtitle="subtitle" :k="theme.k" class="gap-6">
    <div class="flex flex-wrap items-end justify-between gap-4">
      <GStat
        size="lg"
        :label="model.when"
        :value="model.value"
        :delta="model.delta"
        :delta-tone="model.good ? 'good' : 'bad'"
      />
      <GSegmentedControl
        :model-value="range"
        :options="Object.keys(ranges).map((r) => ({ value: r, label: r }))"
        label="Range"
        @update:model-value="pickRange"
      />
    </div>
    <svg
      viewBox="0 0 1000 300"
      class="block h-auto w-full overflow-visible"
      role="img"
      :aria-label="`${title}: ${model.value}, ${model.delta}`"
    >
      <defs>
        <linearGradient :id="gid" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" :stop-color="CHART.primary" stop-opacity="0.3" />
          <stop offset="1" :stop-color="CHART.primary" stop-opacity="0" />
        </linearGradient>
      </defs>
      <GChartGrid
        :lines="model.grid"
        :x1="8"
        :x2="920"
        :label-x="932"
        align="start"
        :opacity="theme.gridOp"
      />
      <text
        v-for="x in model.xl"
        :key="x.x"
        :x="x.x"
        y="292"
        :text-anchor="x.anchor"
        class="fill-label-secondary text-[11px] tabular-nums"
      >
        {{ x.label }}
      </text>
      <path
        :d="model.area"
        :fill="`url(#${gid})`"
        :style="{
          d: cssPath(model.area),
          opacity: revealed ? 1 : 0,
          transition: `d ${dur(700)} var(--ease-smooth), opacity ${dur(900)} var(--ease-smooth) ${dur(500)}`,
        }"
      />
      <path
        :d="model.line"
        pathLength="1"
        fill="none"
        :stroke="CHART.primary"
        stroke-width="2.5"
        stroke-linecap="round"
        stroke-linejoin="round"
        :style="{
          d: cssPath(model.line),
          strokeDasharray: 1,
          strokeDashoffset: revealed ? 0 : 1,
          transition: `d ${dur(700)} var(--ease-smooth), stroke-dashoffset ${dur(1600)} var(--ease-smooth)`,
        }"
      />
      <g v-if="hover != null" class="pointer-events-none">
        <line
          :x1="model.hx"
          :x2="model.hx"
          y1="16"
          y2="268"
          :stroke="CHART.accent"
          stroke-dasharray="3 4"
        />
        <circle
          :cx="model.hx"
          :cy="model.hy"
          r="6"
          fill="var(--color-surface)"
          :stroke="CHART.primary"
          stroke-width="2.5"
        />
      </g>
      <circle
        v-if="hover == null"
        :cx="model.ex"
        :cy="model.ey"
        r="5"
        :fill="CHART.primary"
        stroke="var(--color-surface)"
        stroke-width="2.5"
        class="pointer-events-none"
        :style="{
          opacity: revealed ? 1 : 0,
          transition: `opacity ${dur(300)} var(--ease-smooth) ${dur(1400)}, cy ${dur(700)} var(--ease-snappy)`,
        }"
      />
      <rect
        x="8"
        y="16"
        width="912"
        height="252"
        fill="transparent"
        class="cursor-crosshair touch-none"
        @pointermove="move"
        @pointerleave="hover = null"
      />
    </svg>
  </GChartCard>
</template>
