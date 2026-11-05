<script setup lang="ts">
import { computed, ref } from 'vue'

import { useChartReveal, useChartTheme, type ChartSettings } from './context'
import KChartCard from './KChartCard.vue'
import KChartGrid from './KChartGrid.vue'
import KChartLegend from './KChartLegend.vue'
import KStat from './KStat.vue'
import { CHART } from './lib/palette'
import { dur, f, gridOf, mk, money, smooth, ticks, type Pt } from './lib/scale'

const {
  principal = 420000,
  rate = 0.0625,
  years = 30,
  title = 'Mortgage amortization',
  index,
  kind = 'Stacked column + balance line',
  ...settings
} = defineProps<
  {
    principal?: number
    rate?: number
    years?: number
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
  // Balance (right axis) is scaled to the principal; labels stop at the last tick below it.
  const btk = ticks(0, principal, 5).filter((v) => v <= principal)
  const Yb = (v: number) => T + (1 - v / principal) * ih
  const step = iw / years
  const bw = step * 0.64
  const balPts: Pt[] = [
    [L, Yb(principal)],
    ...yrs.map((d, i): Pt => [L + (i + 1) * step, Yb(d.bal)]),
  ]
  const totI = yrs.reduce((a, d) => a + d.ii, 0)
  const h = hover.value
  const d = h == null ? null : yrs[h]!
  const marks = [1, Math.round(years / 3), Math.round((years * 2) / 3), years]
  return {
    cp: theme.value.P[0]!,
    ci: theme.value.mono ? theme.value.P[3]! : theme.value.P[2]!,
    grid: gridOf(tk, Y, mk),
    gr: btk.map((v) => ({ ty: f(Yb(v) + 4), label: mk(v) })),
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
    bal: smooth(balPts),
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
  <KChartCard ref="card" :title="title" :index="index" :kind="kind" :k="theme.k">
    <div class="flex flex-wrap items-end justify-between gap-3">
      <KStat :label="model.label" :value="model.value" />
      <span class="font-mono text-xs text-fg-muted tabular-nums">{{ model.split }}</span>
    </div>
    <svg
      viewBox="0 0 520 260"
      class="block h-auto w-full overflow-visible"
      role="img"
      :aria-label="`${title}: ${model.label}, ${model.value}`"
      @pointerleave="hover = null"
    >
      <KChartGrid :lines="model.grid" :x1="44" :x2="476" :label-x="36" :opacity="theme.gridOp" />
      <text
        v-for="g in model.gr"
        :key="g.ty"
        x="484"
        :y="g.ty"
        class="fill-fg font-mono text-[11px]"
      >
        {{ g.label }}
      </text>
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
        <rect :x="b.hx" y="12" :width="b.hw" height="220" fill="transparent" />
        <g
          :style="{
            transform: `scaleY(${revealed ? 1 : 0})`,
            transformBox: 'fill-box',
            transformOrigin: 'bottom',
            transition: `transform ${dur(600)} var(--ease-standard) ${dur(b.dl)}`,
          }"
        >
          <rect :x="b.x" :y="b.yi" :width="b.w" :height="b.hi" rx="2" :fill="model.ci" />
          <rect :x="b.x" :y="b.yp" :width="b.w" :height="b.hp" rx="2" :fill="model.cp" />
        </g>
      </g>
      <path
        :d="model.bal"
        pathLength="1"
        fill="none"
        :stroke="CHART.ink"
        stroke-width="2"
        stroke-linecap="round"
        class="pointer-events-none"
        :style="{
          strokeDasharray: 1,
          strokeDashoffset: revealed ? 0 : 1,
          transition: `stroke-dashoffset ${dur(1600)} var(--ease-standard) ${dur(400)}`,
        }"
      />
      <text
        v-for="x in model.xl"
        :key="x.label"
        :x="x.x"
        y="252"
        text-anchor="middle"
        class="fill-fg-muted font-mono text-[11px]"
      >
        {{ x.label }}
      </text>
    </svg>
    <KChartLegend
      :items="[
        { label: 'Principal', color: model.cp },
        { label: 'Interest', color: model.ci },
        { label: 'Balance (right axis)', color: CHART.ink, shape: 'line' },
      ]"
    />
  </KChartCard>
</template>
