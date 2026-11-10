<script setup lang="ts">
import { computed, ref, useId, useTemplateRef } from 'vue'

import { useChartReveal, useChartTheme, type ChartSettings } from './context'
import KChartCard from './KChartCard.vue'
import { CHART, seriesColor } from './lib/palette'
import { dur, round1, money } from './lib/scale'

export interface FlowSource {
  label: string
  value: number
}
export interface FlowTarget {
  label: string
  value: number
  /** Palette index, or a CSS colour. */
  color?: number | string
}

const {
  sources,
  targets,
  title = 'Where income went',
  index,
  kind,
  showGrid = undefined,
  ...settings
} = defineProps<
  {
    /** Income streams (left column). */
    sources: FlowSource[]
    /** Where it went (right column); should sum to the sources' total. */
    targets: FlowTarget[]
    title?: string
    index?: string
    /** Short mono descriptor shown at the right of the header. */
    kind?: string
  } & ChartSettings
>()

const card = useTemplateRef<InstanceType<typeof KChartCard>>('card')
const theme = useChartTheme(() => ({ ...settings, showGrid }))
const { revealed, replay } = useChartReveal(card, () => theme.value.durationScale)
const clipId = `k-sankey-${useId()}`
const hover = ref<string | null>(null)

const model = computed(() => {
  const T = 10
  const H = 320
  const nw = 12
  const x0 = 150
  const x1 = 470
  const x2 = 740
  const total = sources.reduce((a, s) => a + s.value, 0)
  const gap = 10
  // Pixels of node height per unit of money; 0 when there is nothing to draw.
  const pxPerUnit = total > 0 ? (H - gap * (targets.length - 1)) / total : 0
  const band = (xa: number, a0: number, a1: number, xb: number, b0: number, b1: number) => {
    const m = (xa + xb) / 2
    return `M${xa},${round1(a0)} C${m},${round1(a0)} ${m},${round1(b0)} ${xb},${round1(b0)} L${xb},${round1(b1)} C${m},${round1(b1)} ${m},${round1(a1)} ${xa},${round1(a1)} Z`
  }
  const nodes: { x: number; y: number; h: number; c: string }[] = []
  const bands: { id: string; d: string; c: string }[] = []
  const labels: { x: number; y: number; anchor: string; n: string; v: string }[] = []
  let ly = T + (H - (total * pxPerUnit + 24 * (sources.length - 1))) / 2
  let my = T
  sources.forEach((s, i) => {
    const hh = s.value * pxPerUnit
    nodes.push({ x: x0, y: round1(ly), h: round1(hh), c: CHART.ink })
    bands.push({ id: `s${i}`, d: band(x0 + nw, ly, ly + hh, x1, my, my + hh), c: CHART.muted })
    labels.push({
      x: x0 - 12,
      y: round1(ly + hh / 2),
      anchor: 'end',
      n: s.label,
      v: money(s.value),
    })
    ly += hh + 24
    my += hh
  })
  nodes.push({ x: x1, y: T, h: round1(total * pxPerUnit), c: CHART.ink })
  let ry = T
  let sy = T
  targets.forEach((t, i) => {
    const hh = t.value * pxPerUnit
    const c = seriesColor(theme.value.series, t.color ?? i)
    nodes.push({ x: x2, y: round1(ry), h: round1(hh), c })
    bands.push({ id: `t${i}`, d: band(x1 + nw, sy, sy + hh, x2, ry, ry + hh), c })
    labels.push({
      x: x2 + nw + 12,
      y: round1(ry + hh / 2),
      anchor: 'start',
      n: t.label,
      v: `${money(t.value)} · ${total > 0 ? Math.round((t.value / total) * 100) : 0}%`,
    })
    ry += hh + gap
    sy += hh
  })
  return {
    total,
    nodes,
    bands: bands.map((b) => ({
      ...b,
      op: hover.value == null ? 0.3 : hover.value === b.id ? 0.6 : 0.1,
    })),
    labels: labels.map((l, i) => ({ ...l, dl: 300 + i * 80 })),
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
    :empty="!(model.total > 0)"
  >
    <svg
      viewBox="0 0 1000 340"
      class="block h-auto w-full overflow-visible"
      role="img"
      :aria-label="`${title}: ${model.labels.map((l) => `${l.n} ${l.v}`).join('; ')}`"
    >
      <defs>
        <clipPath :id="clipId">
          <rect
            x="0"
            y="0"
            width="1000"
            height="340"
            :style="{
              transform: `scaleX(${revealed ? 1 : 0})`,
              transformBox: 'view-box',
              transformOrigin: '150px 0',
              transition: `transform ${dur(1600)} var(--ease-standard)`,
            }"
          />
        </clipPath>
      </defs>
      <g :clip-path="`url(#${clipId})`">
        <path
          v-for="b in model.bands"
          :key="b.id"
          :d="b.d"
          :fill="b.c"
          class="cursor-pointer"
          :style="{
            fillOpacity: b.op,
            transition: 'fill-opacity var(--duration-slow) var(--ease-standard)',
          }"
          @pointerenter="hover = b.id"
          @pointerleave="hover = null"
        />
        <rect
          v-for="(n, i) in model.nodes"
          :key="i"
          :x="n.x"
          :y="n.y"
          width="12"
          :height="n.h"
          rx="4"
          :fill="n.c"
        />
      </g>
      <!-- One-line labels with a surface-coloured halo so they stay legible across flows. -->
      <g
        v-for="(l, i) in model.labels"
        :key="i"
        :style="{
          opacity: revealed ? 1 : 0,
          transition: `opacity ${dur(500)} var(--ease-standard) ${dur(l.dl)}`,
        }"
      >
        <text
          :x="l.x"
          :y="l.y"
          :text-anchor="l.anchor"
          dominant-baseline="central"
          class="stroke-surface [stroke-width:4px] [paint-order:stroke] [stroke-linejoin:round]"
        >
          <tspan class="fill-fg font-sans text-base font-semibold">{{ l.n }}</tspan>
          <tspan dx="8" class="fill-fg-muted font-mono text-sm">{{ l.v }}</tspan>
        </text>
      </g>
    </svg>
  </KChartCard>
</template>
