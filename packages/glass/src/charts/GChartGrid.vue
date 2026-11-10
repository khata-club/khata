<script setup lang="ts">
/**
 * Horizontal grid lines with their y labels (SVG fragment, place inside an <svg>). Lines are
 * dashed hairlines; labels sit at the trailing edge by default, like Stocks and Health.
 */
const { align = 'end' } = defineProps<{
  lines: { y: number; ty: number; label: string }[]
  x1: number
  x2: number
  /** x of the label's anchor edge. */
  labelX: number
  /** `end`: right-aligned at labelX (leading axis); `start`: left-aligned (trailing axis). */
  align?: 'start' | 'end'
  opacity?: number
  /** Draw labels only (e.g. 100% stacked charts). */
  labelsOnly?: boolean
}>()
</script>

<template>
  <g>
    <template v-for="(g, i) in lines" :key="g.y">
      <line
        v-if="!labelsOnly"
        :x1="x1"
        :x2="x2"
        :y1="g.y"
        :y2="g.y"
        stroke="var(--color-separator)"
        :stroke-dasharray="i === 0 ? undefined : '2 4'"
        :stroke-opacity="opacity ?? 1"
      />
      <text
        :x="labelX"
        :y="g.ty"
        :text-anchor="align"
        class="fill-label-secondary text-[12px] tabular-nums"
      >
        {{ g.label }}
      </text>
    </template>
  </g>
</template>
