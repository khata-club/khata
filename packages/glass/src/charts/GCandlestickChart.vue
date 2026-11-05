<script setup lang="ts">
import { computed, ref } from 'vue'

import { useChartReveal, useChartTheme, type ChartSettings } from './context'
import GChartCard from './GChartCard.vue'
import GChartGrid from './GChartGrid.vue'
import GStat from './GStat.vue'
import { CHART } from './lib/palette'
import { dur, f, gridOf, MONTHS, ticks } from './lib/scale'

export interface Candle {
  o: number
  h: number
  l: number
  c: number
  /** Relative volume (any unit). */
  v: number
}

const {
  candles,
  end,
  name = 'Total market fund',
  title = 'Holding price',
  subtitle,
  ...settings
} = defineProps<
  {
    /** Daily OHLC + volume, oldest first. */
    candles: Candle[]
    /** Date of the last candle; earlier candles step back over weekdays. */
    end: Date
    name?: string
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
  const cs = candles
  const L = 44
  const T = 10
  const ph = 170
  const iw = 468
  const tk = ticks(Math.min(...cs.map((c) => c.l)), Math.max(...cs.map((c) => c.h)), 4)
  const y0 = tk[0]!
  const y1 = tk[tk.length - 1]!
  const Y = (v: number) => T + (1 - (v - y0) / (y1 - y0)) * ph
  const step = iw / cs.length
  const bw = step * 0.62
  const vmax = Math.max(...cs.map((c) => c.v))
  const hI = hover.value ?? cs.length - 1
  const c = cs[hI]!
  const prev = hI ? cs[hI - 1]!.c : c.o
  const ch = c.c - prev
  const date = (i: number) => {
    const d = new Date(end)
    let n = cs.length - 1 - i
    while (n > 0) {
      d.setDate(d.getDate() - 1)
      if (d.getDay() % 6) n--
    }
    return `${MONTHS[d.getMonth()]} ${d.getDate()}`
  }
  return {
    grid: gridOf(tk, Y, (v) => v.toFixed(0)),
    bars: cs.map((c, i) => {
      const x = L + i * step + step / 2
      return {
        x: f(x),
        hx: f(L + i * step),
        hw: f(step),
        bx: f(x - bw / 2),
        bw: f(bw),
        wy1: f(Y(c.h)),
        wy2: f(Y(c.l)),
        by: f(Y(Math.max(c.o, c.c))),
        bh: f(Math.max(1.5, Math.abs(Y(c.o) - Y(c.c)))),
        col: c.c >= c.o ? CHART.good : CHART.bad,
        vh: f((c.v / vmax) * 40),
        vy: f(244 - (c.v / vmax) * 40),
        dl: i * 24,
        op: hover.value == null || hover.value === i ? 1 : 0.4,
      }
    }),
    when: hover.value == null ? `${date(cs.length - 1)} close` : date(hI),
    price: '$' + c.c.toFixed(2),
    chg: `${ch >= 0 ? '+' : '−'}${Math.abs(ch).toFixed(2)} (${ch >= 0 ? '+' : '−'}${Math.abs((ch / prev) * 100).toFixed(2)}%)`,
    up: ch >= 0,
    ohlc: `O ${c.o.toFixed(2)}  H ${c.h.toFixed(2)}  L ${c.l.toFixed(2)}  C ${c.c.toFixed(2)}`,
  }
})

defineExpose({ replay })
</script>

<template>
  <GChartCard ref="card" :title="title" :subtitle="subtitle" :k="theme.k">
    <div class="flex flex-wrap items-end justify-between gap-3">
      <GStat
        :label="`${name} · ${model.when}`"
        :value="model.price"
        :delta="model.chg"
        :delta-tone="model.up ? 'good' : 'bad'"
      />
      <span class="text-footnote whitespace-pre text-label-secondary tabular-nums">{{
        model.ohlc
      }}</span>
    </div>
    <svg
      viewBox="0 0 520 260"
      class="block h-auto w-full overflow-visible"
      role="img"
      :aria-label="`${name} price, ${model.price}`"
      @pointerleave="hover = null"
    >
      <GChartGrid :lines="model.grid" :x1="44" :x2="512" :label-x="36" :opacity="theme.gridOp" />
      <line x1="44" x2="512" y1="244" y2="244" stroke="var(--color-separator)" />
      <text x="36" y="232" text-anchor="end" class="fill-label-secondary text-[11px] tabular-nums">
        Vol
      </text>
      <g
        v-for="(c, i) in model.bars"
        :key="i"
        :style="{
          opacity: c.op,
          transition: 'opacity var(--duration-normal) var(--ease-smooth)',
        }"
        @pointerenter="hover = i"
      >
        <rect :x="c.hx" y="10" :width="c.hw" height="234" fill="transparent" />
        <g
          :style="{
            transform: `scaleY(${revealed ? 1 : 0})`,
            transformBox: 'fill-box',
            transformOrigin: 'center',
            transition: `transform ${dur(600)} var(--ease-smooth) ${dur(c.dl)}`,
          }"
        >
          <line :x1="c.x" :x2="c.x" :y1="c.wy1" :y2="c.wy2" :stroke="c.col" stroke-width="1.25" />
          <rect :x="c.bx" :y="c.by" :width="c.bw" :height="c.bh" rx="1.5" :fill="c.col" />
        </g>
        <rect
          :x="c.bx"
          :y="c.vy"
          :width="c.bw"
          :height="c.vh"
          rx="1.5"
          :fill="c.col"
          fill-opacity="0.28"
          :style="{
            transform: `scaleY(${revealed ? 1 : 0})`,
            transformBox: 'fill-box',
            transformOrigin: 'bottom',
            transition: `transform ${dur(600)} var(--ease-smooth) ${dur(c.dl)}`,
          }"
        />
      </g>
    </svg>
  </GChartCard>
</template>
