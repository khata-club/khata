<script setup lang="ts">
import { computed, useTemplateRef } from 'vue'

import { useChartReveal, useChartTheme, type ChartSettings } from './context'
import KChartCard from './KChartCard.vue'
import KChartLegend from './KChartLegend.vue'
import { CHART } from './lib/palette'
import { dur, round1 } from './lib/scale'

const {
  axes,
  current,
  previous,
  currentLabel = 'This year',
  previousLabel = 'Last year',
  title = 'Financial health',
  index,
  kind,
  showGrid = undefined,
  ...settings
} = defineProps<
  {
    axes: string[]
    /** 0–100 per axis. */
    current: number[]
    previous?: number[]
    currentLabel?: string
    previousLabel?: string
    title?: string
    index?: string
    /** Short mono descriptor shown at the right of the header. */
    kind?: string
  } & ChartSettings
>()

const card = useTemplateRef<InstanceType<typeof KChartCard>>('card')
const theme = useChartTheme(() => ({ ...settings, showGrid }))
const { revealed, replay } = useChartReveal(card, () => theme.value.durationScale)

const model = computed(() => {
  const cx = 240
  const cy = 150
  const R = 100
  const n = axes.length
  const pt = (i: number, v: number) => {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / n
    return [cx + (Math.cos(a) * R * v) / 100, cy + (Math.sin(a) * R * v) / 100] as const
  }
  const poly = (vs: number[]) => vs.map((v, i) => pt(i, v).map(round1).join(',')).join(' ')
  const avg = (a: number[]) => Math.round(a.reduce((x, y) => x + y, 0) / a.length)
  return {
    rings: [25, 50, 75, 100].map((l) => poly(Array(n).fill(l))),
    axes: axes.map((name, i) => {
      const [x, y] = pt(i, 100)
      const [lx, ly] = pt(i, 120)
      return {
        name,
        val: current[i],
        x2: round1(x),
        y2: round1(y),
        lx: round1(lx),
        ly: round1(ly + 4),
        anchor: Math.abs(lx - cx) < 4 ? 'middle' : lx > cx ? 'start' : 'end',
      }
    }),
    now: poly(current),
    last: previous ? poly(previous) : null,
    dots: current.map((v, i) => pt(i, v).map(round1)),
    avg: avg(current),
    avgLast: previous ? avg(previous) : null,
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
    :empty="axes.length < 3"
  >
    <svg
      viewBox="0 0 480 300"
      class="block h-auto w-full overflow-visible"
      role="img"
      :aria-label="`${title}: ${axes.map((a, i) => `${a} ${current[i]}`).join(', ')}`"
    >
      <polygon
        v-for="(r, i) in model.rings"
        :key="i"
        :points="r"
        fill="none"
        :stroke="CHART.grid"
        :stroke-opacity="theme.gridOpacity"
      />
      <g v-for="(a, i) in model.axes" :key="i">
        <line
          x1="240"
          y1="150"
          :x2="a.x2"
          :y2="a.y2"
          :stroke="CHART.grid"
          :stroke-opacity="theme.gridOpacity"
        />
        <text
          :x="a.lx"
          :y="a.ly"
          :text-anchor="a.anchor"
          class="fill-fg font-sans text-[13px] font-semibold"
        >
          {{ a.name }}
          <tspan class="fill-fg-muted font-mono text-[11px] font-normal">{{ a.val }}</tspan>
        </text>
      </g>
      <g
        v-if="model.last"
        :style="{
          transform: `scale(${revealed ? 1 : 0})`,
          opacity: revealed ? 1 : 0,
          transformBox: 'view-box',
          transformOrigin: '240px 150px',
          transition: `transform ${dur(900)} var(--ease-standard), opacity ${dur(600)} var(--ease-standard)`,
        }"
      >
        <polygon
          :points="model.last"
          fill="none"
          :stroke="CHART.muted"
          stroke-width="1.5"
          stroke-dasharray="4 4"
        />
      </g>
      <g
        :style="{
          transform: `scale(${revealed ? 1 : 0})`,
          transformBox: 'view-box',
          transformOrigin: '240px 150px',
          transition: `transform ${dur(1100)} var(--ease-standard) ${dur(200)}`,
        }"
      >
        <polygon
          :points="model.now"
          :fill="CHART.primary"
          fill-opacity="0.14"
          :stroke="CHART.primary"
          stroke-width="2.5"
          stroke-linejoin="round"
        />
        <circle
          v-for="(d, i) in model.dots"
          :key="i"
          :cx="d[0]"
          :cy="d[1]"
          r="4"
          class="fill-surface"
          :stroke="CHART.primary"
          stroke-width="2"
        />
      </g>
    </svg>
    <KChartLegend
      :items="[
        { label: `${currentLabel} · ${model.avg}`, color: CHART.primary, shape: 'line' },
        ...(model.avgLast != null
          ? [
              {
                label: `${previousLabel} · ${model.avgLast}`,
                color: CHART.muted,
                shape: 'dashed' as const,
              },
            ]
          : []),
      ]"
    />
  </KChartCard>
</template>
