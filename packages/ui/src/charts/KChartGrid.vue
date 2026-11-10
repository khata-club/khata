<script setup lang="ts">
/** Horizontal grid lines with right-aligned y labels (SVG fragment, place inside an <svg>). */
defineProps<{
  lines: { y: number; ty: number; label: string }[]
  x1: number
  x2: number
  /** x of the label's right edge. */
  labelX: number
  opacity?: number
  /** Draw labels only (e.g. 100% stacked charts). */
  labelsOnly?: boolean
}>()
</script>

<template>
  <g>
    <template v-for="g in lines" :key="g.y">
      <line
        v-if="!labelsOnly"
        :x1="x1"
        :x2="x2"
        :y1="g.y"
        :y2="g.y"
        class="stroke-line"
        :stroke-opacity="opacity ?? 1"
      />
      <text :x="labelX" :y="g.ty" text-anchor="end" class="fill-fg-muted font-mono text-[11px]">{{
        g.label
      }}</text>
    </template>
  </g>
</template>
