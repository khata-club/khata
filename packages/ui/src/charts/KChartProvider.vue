<script setup lang="ts">
import { computed } from 'vue'

import { provideCharts } from './context'
import type { ChartPalette } from './lib/palette'

// Unset props fall through to CHART_DEFAULTS (`showGrid = undefined` stops Vue casting it to false).
const {
  palette,
  animationSpeed,
  showGrid = undefined,
} = defineProps<{
  palette?: ChartPalette
  /** 0.5–2×; reduced-motion viewers always get near-instant transitions. */
  animationSpeed?: number
  showGrid?: boolean
}>()

const { replay } = provideCharts(computed(() => ({ palette, animationSpeed, showGrid })))

/** Re-run every descendant chart's entrance animation. */
defineExpose({ replay })
</script>

<template>
  <slot :replay="replay" />
</template>
