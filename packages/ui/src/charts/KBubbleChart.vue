<script setup lang="ts">
import { computed, ref, useTemplateRef } from 'vue'

import { useChartReveal, useChartTheme, type ChartSettings } from './context'
import KChartCard from './KChartCard.vue'
import KChartGrid from './KChartGrid.vue'
import KStat from './KStat.vue'
import { seriesColor } from './lib/palette'
import { compactMoney, dur, gridOf, round1 } from './lib/scale'

export interface BubblePoint {
  label: string
  /** Volatility, % (x). */
  risk: number
  /** Annual return, % (y). */
  ret: number
  /** Holding size in thousands of the chart currency (bubble area). */
  size: number
  color?: number
}

const {
  points,
  xMax = 40,
  yMax = 16,
  title = 'Risk vs return',
  index,
  kind,
  showGrid = undefined,
  ...settings
} = defineProps<
  {
    points: BubblePoint[]
    xMax?: number
    yMax?: number
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
  const iw = 464
  const ih = 216
  const X = (risk: number) => L + (risk / xMax) * iw
  const Y = (ret: number) => T + (1 - ret / yMax) * ih
  const active = hover.value
  const total = points.reduce((a, p) => a + p.size, 0)
  const quarters = [0, 0.25, 0.5, 0.75, 1]
  return {
    gy: gridOf(
      quarters.map((t) => t * yMax),
      Y,
      (v) => v + '%',
    ),
    gx: quarters.map((t) => t * xMax).map((v) => ({ x: round1(X(v)), label: v + '%' })),
    pts: points.map((p, i) => {
      const r = Math.sqrt(p.size) * 3.6
      return {
        ...p,
        cx: round1(X(p.risk)),
        cy: round1(Y(p.ret)),
        r: round1(r),
        c: seriesColor(theme.value.series, p.color ?? i),
        lx: round1(X(p.risk) + r + 4),
        ly: round1(Y(p.ret) + 4),
        dl: i * 110,
        op: active == null || active === i ? 1 : 0.3,
      }
    }),
    label: active == null ? 'Hover a holding' : points[active]!.label,
    value:
      active == null
        ? `${points.length} holdings · ${compactMoney(total * 1000)}`
        : `${points[active]!.ret}% return · ${points[active]!.risk}% volatility · ${compactMoney(
            points[active]!.size * 1000,
          )}`,
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
    :empty="!points.length"
  >
    <KStat :label="model.label" :value="model.value" size="sm" />
    <svg
      viewBox="0 0 520 260"
      class="block h-auto w-full overflow-visible"
      role="img"
      :aria-label="`${title}: ${points.map((p) => `${p.label} ${p.ret}% return, ${p.risk}% volatility`).join('; ')}`"
    >
      <KChartGrid :lines="model.gy" :x1="44" :x2="508" :label-x="36" :opacity="theme.gridOpacity" />
      <text
        v-for="g in model.gx"
        :key="g.x"
        :x="g.x"
        y="244"
        text-anchor="middle"
        class="fill-fg-muted font-mono text-[11px]"
      >
        {{ g.label }}
      </text>
      <text x="508" y="258" text-anchor="end" class="fill-fg font-mono text-[11px]">
        Volatility →
      </text>
      <text x="44" y="6" class="fill-fg font-mono text-[11px]">↑ Return</text>
      <g
        v-for="(p, i) in model.pts"
        :key="i"
        class="cursor-pointer"
        :style="{
          opacity: p.op,
          transition: 'opacity var(--duration-normal) var(--ease-standard)',
        }"
        @pointerenter="hover = i"
        @pointerleave="hover = null"
      >
        <circle
          :cx="p.cx"
          :cy="p.cy"
          :r="p.r"
          :fill="p.c"
          fill-opacity="0.8"
          class="stroke-surface"
          stroke-width="2"
          :style="{
            transform: `scale(${revealed ? 1 : 0})`,
            transformBox: 'fill-box',
            transformOrigin: 'center',
            transition: `transform ${dur(700)} var(--ease-spring) ${dur(p.dl)}`,
          }"
        />
        <text
          :x="p.lx"
          :y="p.ly"
          class="fill-fg font-sans text-xs font-semibold"
          :style="{
            opacity: revealed ? 1 : 0,
            transition: `opacity ${dur(400)} var(--ease-standard) ${dur(p.dl)}`,
          }"
        >
          {{ p.label }}
        </text>
      </g>
    </svg>
  </KChartCard>
</template>
