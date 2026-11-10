<script setup lang="ts">
import { computed, ref, useTemplateRef } from 'vue'

import { useChartReveal, useChartTheme, type ChartSettings } from './context'
import KChartCard from './KChartCard.vue'
import KChartGrid from './KChartGrid.vue'
import KChartLegend from './KChartLegend.vue'
import KStat from './KStat.vue'
import { CHART } from './lib/palette'
import { compactMoney, dur, gridOf, money, round1, smooth, ticks, type Pt } from './lib/scale'

const {
  principal,
  rate,
  years,
  title = 'Mortgage amortization',
  index,
  kind,
  showGrid = undefined,
  ...settings
} = defineProps<
  {
    /** Amount borrowed. */
    principal: number
    /** Annual interest rate as a fraction (0.0625 = 6.25%); 0 for an interest-free loan. */
    rate: number
    /** Whole years (at least 1). */
    years: number
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
  const iw = 432
  const ih = 220
  const term = Math.max(1, Math.round(years))
  const monthlyRate = rate / 12
  // The annuity formula divides by zero for an interest-free loan: repay in equal parts instead.
  const pay =
    monthlyRate === 0
      ? principal / (term * 12)
      : (principal * monthlyRate) / (1 - Math.pow(1 + monthlyRate, -term * 12))
  let balance = principal
  const yearly: { principalPaid: number; interestPaid: number; balance: number }[] = []
  for (let y = 0; y < term; y++) {
    let principalPaid = 0
    let interestPaid = 0
    for (let m = 0; m < 12; m++) {
      const interest = balance * monthlyRate
      const principalPart = pay - interest
      interestPaid += interest
      principalPaid += principalPart
      balance -= principalPart
    }
    yearly.push({ principalPaid, interestPaid, balance: Math.max(balance, 0) })
  }
  const tk = ticks(0, pay * 12, 4)
  const y1 = tk[tk.length - 1]!
  const Y = (value: number) => T + (1 - value / y1) * ih
  // Balance (right axis) is scaled to the principal; labels stop at the last tick below it.
  const btk = ticks(0, principal, 5).filter((v) => v <= principal)
  const Yb = (value: number) => T + (1 - value / principal) * ih
  const step = iw / term
  const bw = step * 0.64
  const balPts: Pt[] = [
    [L, Yb(principal)],
    ...yearly.map((d, i): Pt => [L + (i + 1) * step, Yb(d.balance)]),
  ]
  const totalInterest = yearly.reduce((a, d) => a + d.interestPaid, 0)
  const active = hover.value
  const year = active == null ? null : yearly[active]!
  // Axis marks at the start, thirds and end, without repeats on short terms.
  const marks = [...new Set([1, Math.round(term / 3), Math.round((term * 2) / 3), term])].filter(
    (y) => y >= 1,
  )
  const terms = `${compactMoney(principal)} at ${(rate * 100).toFixed(2)}% · ${term} years`
  return {
    cp: theme.value.series[0]!,
    ci: theme.value.mono ? theme.value.series[3]! : theme.value.series[2]!,
    grid: gridOf(tk, Y, compactMoney),
    gr: btk.map((v) => ({ ty: round1(Yb(v) + 4), label: compactMoney(v) })),
    bars: yearly.map((d, i) => ({
      x: round1(L + i * step + (step - bw) / 2),
      w: round1(bw),
      hx: round1(L + i * step),
      hw: round1(step),
      yp: round1(Y(d.principalPaid)),
      hp: round1((d.principalPaid / y1) * ih),
      yi: round1(Y(d.principalPaid + d.interestPaid)),
      hi: round1((d.interestPaid / y1) * ih),
      dl: i * 26,
      op: active == null || active === i ? 1 : 0.4,
    })),
    bal: smooth(balPts),
    xl: marks.map((y) => ({ x: round1(L + (y - 0.5) * step), label: `Yr ${y}` })),
    label: year ? `Year ${active! + 1} · balance ${money(year.balance)}` : terms,
    value: year
      ? `${money(year.principalPaid + year.interestPaid)} paid`
      : `${money(totalInterest)} interest`,
    split: year
      ? `Principal ${money(year.principalPaid)} · Interest ${money(year.interestPaid)}`
      : `${money(pay)}/mo`,
    summary: `${title}: ${terms}, ${money(pay)} a month, ${money(totalInterest)} total interest`,
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
    :empty="!(principal > 0)"
  >
    <div class="flex flex-wrap items-end justify-between gap-3">
      <KStat :label="model.label" :value="model.value" />
      <span class="font-mono text-xs text-fg-muted tabular-nums">{{ model.split }}</span>
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
        :x2="476"
        :label-x="36"
        :opacity="theme.gridOpacity"
      />
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
