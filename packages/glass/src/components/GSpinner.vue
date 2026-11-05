<script setup lang="ts">
import { cn } from '../lib/cn'

const { size = 20, class: className } = defineProps<{ size?: number; class?: string }>()
</script>

<template>
  <!-- Eight-spoke activity indicator: the whole wheel steps round one spoke at a time. -->
  <svg
    aria-hidden="true"
    viewBox="0 0 24 24"
    :width="size"
    :height="size"
    data-slot="spinner"
    :class="cn('shrink-0 animate-g-spin', className)"
  >
    <line
      v-for="i in 8"
      :key="i"
      x1="12"
      y1="3"
      x2="12"
      y2="7.5"
      stroke="currentColor"
      stroke-width="2.4"
      stroke-linecap="round"
      :opacity="1 - (i - 1) * 0.11"
      :transform="`rotate(${-(i - 1) * 45} 12 12)`"
    />
  </svg>
</template>
