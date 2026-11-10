<script setup lang="ts">
import { computed, ref, useTemplateRef } from 'vue'

import { useChartReveal, useChartTheme, type ChartSettings } from './context'
import KChartCard from './KChartCard.vue'
import KChartGrid from './KChartGrid.vue'
import KStat from './KStat.vue'
import { CHART } from './lib/palette'
import { dur, gridOf, money, MONTHS, pct, pctChange, round1, ticks } from './lib/scale'

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
  name,
  title = 'Holding price',
  index,
  kind,
  showGrid = undefined,
  ...settings
} = defineProps<
  {
    /** Daily OHLC + volume, oldest first. */
    candles: Candle[]
    /** Date of the last candle; earlier candles step back over weekdays. */
    end: Date
    /** Holding name, shown in the read-out and the accessible name. */
    name: string
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
  const cs = candles
  const L = 44
  const T = 10
  const ph = 170
  const iw = 468
  const tk = ticks(Math.min(...cs.map((c) => c.l)), Math.max(...cs.map((c) => c.h)), 4)
  const y0 = tk[0]!
  const y1 = tk[tk.length - 1]!
  const Y = (value: number) => T + (1 - (value - y0) / (y1 - y0)) * ph
  const step = iw / cs.length
  const bw = step * 0.62
  const vmax = Math.max(...cs.map((c) => c.v))
  const active = hover.value ?? cs.length - 1
  const c = cs[active]!
  const prev = active ? cs[active - 1]!.c : c.o
  const change = c.c - prev
  const changePct = pctChange(prev, c.c)
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
        x: round1(x),
        hx: round1(L + i * step),
        hw: round1(step),
        bx: round1(x - bw / 2),
        bw: round1(bw),
        wy1: round1(Y(c.h)),
        wy2: round1(Y(c.l)),
        by: round1(Y(Math.max(c.o, c.c))),
        bh: round1(Math.max(1.5, Math.abs(Y(c.o) - Y(c.c)))),
        col: c.c >= c.o ? CHART.good : CHART.bad,
        // Up days are hollow, down days filled, so direction doesn't rely on colour alone.
        up: c.c >= c.o,
        vh: round1((c.v / vmax) * 40),
        vy: round1(244 - (c.v / vmax) * 40),
        dl: i * 24,
        op: hover.value == null || hover.value === i ? 1 : 0.4,
      }
    }),
    when: hover.value == null ? `${date(cs.length - 1)} close` : date(active),
    price: money(c.c),
    chg: `${change >= 0 ? '+' : '−'}${Math.abs(change).toFixed(2)}${
      changePct === null ? '' : ` (${pct(changePct, 2)})`
    }`,
    up: change >= 0,
    summary: `${name} price over ${cs.length} trading days, last close ${money(
      cs[cs.length - 1]!.c,
    )}`,
    ohlc: `O ${c.o.toFixed(2)}  H ${c.h.toFixed(2)}  L ${c.l.toFixed(2)}  C ${c.c.toFixed(2)}`,
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
    :empty="!candles.length"
  >
    <div class="flex flex-wrap items-end justify-between gap-3">
      <KStat
        :label="`${name} · ${model.when}`"
        :value="model.price"
        :delta="model.chg"
        :delta-tone="model.up ? 'good' : 'bad'"
      />
      <span class="font-mono text-xs whitespace-pre text-fg-muted tabular-nums">{{
        model.ohlc
      }}</span>
    </div>
    <svg
      viewBox="0 0 520 260"
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
      <line x1="44" x2="512" y1="244" y2="244" class="stroke-line" />
      <text x="36" y="232" text-anchor="end" class="fill-fg-muted font-mono text-[11px]">Vol</text>
      <g
        v-for="(c, i) in model.bars"
        :key="i"
        :style="{
          opacity: c.op,
          transition: 'opacity var(--duration-normal) var(--ease-standard)',
        }"
        @pointerenter="hover = i"
      >
        <rect :x="c.hx" y="10" :width="c.hw" height="234" fill="transparent" />
        <g
          :style="{
            transform: `scaleY(${revealed ? 1 : 0})`,
            transformBox: 'fill-box',
            transformOrigin: 'center',
            transition: `transform ${dur(600)} var(--ease-standard) ${dur(c.dl)}`,
          }"
        >
          <line :x1="c.x" :x2="c.x" :y1="c.wy1" :y2="c.wy2" :stroke="c.col" stroke-width="1.25" />
          <rect
            :x="c.bx + (c.up ? 0.75 : 0)"
            :y="c.by"
            :width="c.up ? Math.max(0, c.bw - 1.5) : c.bw"
            :height="c.bh"
            rx="1.5"
            :style="{ fill: c.up ? 'var(--color-surface)' : c.col }"
            :stroke="c.up ? c.col : 'none'"
            stroke-width="1.5"
          />
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
            transition: `transform ${dur(600)} var(--ease-standard) ${dur(c.dl)}`,
          }"
        />
      </g>
    </svg>
  </KChartCard>
</template>
