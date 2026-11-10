<script setup lang="ts">
import { ArrowLeftRight } from '@lucide/vue'
import { computed } from 'vue'

import type { Category } from '#shared/types'
import { CATEGORY_ICON } from '@/lib/icons'

const {
  category,
  transfer = false,
  size = 36,
} = defineProps<{
  category?: Category | null
  transfer?: boolean
  size?: number
}>()

const icon = computed(() => (transfer ? ArrowLeftRight : CATEGORY_ICON[category?.icon ?? 'circle']))
const color = computed(() => (transfer ? 'var(--color-primary)' : (category?.color ?? '#6b7280')))
</script>

<template>
  <span
    aria-hidden="true"
    class="grid shrink-0 place-items-center rounded-full"
    :style="{
      width: `${size}px`,
      height: `${size}px`,
      color,
      backgroundColor: `color-mix(in srgb, ${color} 14%, transparent)`,
    }"
  >
    <component :is="icon" :size="Math.round(size * 0.5)" />
  </span>
</template>
