<script setup lang="ts">
import { computed, useId } from 'vue'

import { CHART } from './lib/palette'
import { dur, smooth } from './lib/scale'

const {
  values,
  color = CHART.primary,
  revealed = true,
  delay = 0,
  height = 56,
} = defineProps<{
  values: number[]
  color?: string
  /** Draws the line in (and fades the fill) when it becomes true. */
  revealed?: boolean
  /** Entrance delay in ms (scaled by `--k`). */
  delay?: number
  height?: number
}>()

const gid = `k-spark-${useId()}`
const W = 200
const line = computed(() => {
  const lo = Math.min(...values)
  const hi = Math.max(...values)
  const span = hi - lo || 1
  return smooth(
    values.map((v, j) => [(j / (values.length - 1)) * W, 4 + (1 - (v - lo) / span) * (height - 8)]),
  )
})
</script>

<template>
  <svg
    :viewBox="`0 0 ${W} ${height}`"
    preserveAspectRatio="none"
    aria-hidden="true"
    class="block w-full overflow-visible"
    :style="{ height: `${height}px` }"
  >
    <defs>
      <linearGradient :id="gid" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" :stop-color="CHART.primary" stop-opacity="0.14" />
        <stop offset="1" :stop-color="CHART.primary" stop-opacity="0" />
      </linearGradient>
    </defs>
    <path
      :d="`${line} L${W},${height} L0,${height} Z`"
      :fill="`url(#${gid})`"
      :style="{
        opacity: revealed ? 1 : 0,
        transition: `opacity ${dur(800)} var(--ease-standard) ${dur(delay + 600)}`,
      }"
    />
    <path
      :d="line"
      pathLength="1"
      fill="none"
      :stroke="color"
      stroke-width="2"
      stroke-linecap="round"
      vector-effect="non-scaling-stroke"
      :style="{
        strokeDasharray: 1,
        strokeDashoffset: revealed ? 0 : 1,
        transition: `stroke-dashoffset ${dur(1200)} var(--ease-standard) ${dur(delay)}`,
      }"
    />
  </svg>
</template>
