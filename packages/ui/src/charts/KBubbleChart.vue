<script setup lang="ts">
import { computed, ref } from 'vue'

import { useChartReveal, useChartTheme, type ChartSettings } from './context'
import KChartCard from './KChartCard.vue'
import KChartGrid from './KChartGrid.vue'
import KStat from './KStat.vue'
import { dur, f } from './lib/scale'

export interface BubblePoint {
  label: string
  /** Volatility, % (x). */
  risk: number
  /** Annual return, % (y). */
  ret: number
  /** Holding size in $k (bubble area). */
  size: number
  color?: number
}

const {
  points,
  xMax = 40,
  yMax = 16,
  title = 'Risk vs return',
  index,
  kind = 'Bubble scatter · size = holding',
  ...settings
} = defineProps<
  {
    points: BubblePoint[]
    xMax?: number
    yMax?: number
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
  const iw = 464
  const ih = 216
  const X = (v: number) => L + (v / xMax) * iw
  const Y = (v: number) => T + (1 - v / yMax) * ih
  const h = hover.value
  const total = points.reduce((a, p) => a + p.size, 0)
  return {
    gy: [0, 0.25, 0.5, 0.75, 1]
      .map((t) => t * yMax)
      .map((v) => ({ y: f(Y(v)), ty: f(Y(v) + 4), label: v + '%' })),
    gx: [0, 0.25, 0.5, 0.75, 1].map((t) => t * xMax).map((v) => ({ x: f(X(v)), label: v + '%' })),
    pts: points.map((p, i) => {
      const r = Math.sqrt(p.size) * 3.6
      return {
        ...p,
        cx: f(X(p.risk)),
        cy: f(Y(p.ret)),
        r: f(r),
        c: theme.value.P[p.color ?? i % 6]!,
        lx: f(X(p.risk) + r + 4),
        ly: f(Y(p.ret) + 4),
        dl: i * 110,
        op: h == null || h === i ? 1 : 0.3,
      }
    }),
    label: h == null ? 'Hover a holding' : points[h]!.label,
    value:
      h == null
        ? `${points.length} holdings · $${total}k`
        : `${points[h]!.ret}% return · ${points[h]!.risk}% volatility · $${points[h]!.size}k`,
  }
})

defineExpose({ replay })
</script>

<template>
  <KChartCard ref="card" :title="title" :index="index" :kind="kind" :k="theme.k">
    <KStat :label="model.label" :value="model.value" size="sm" />
    <svg
      viewBox="0 0 520 260"
      class="block h-auto w-full overflow-visible"
      role="img"
      :aria-label="`${title}: ${points.map((p) => `${p.label} ${p.ret}% return, ${p.risk}% volatility`).join('; ')}`"
    >
      <KChartGrid :lines="model.gy" :x1="44" :x2="508" :label-x="36" :opacity="theme.gridOp" />
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
        :key="p.label"
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
          stroke="#fff"
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
