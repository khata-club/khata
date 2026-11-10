<script setup lang="ts">
import { cn } from '../lib/cn'

const { label, class: className } = defineProps<{
  /** Accessible name for the navigation landmark. */
  label: string
  class?: string
}>()
</script>

<template>
  <div data-slot="sidebar" :class="cn('flex h-full flex-col', className)">
    <div v-if="$slots.header" class="flex items-center gap-3 px-5 pt-5 pb-3">
      <slot name="header" />
    </div>
    <nav :aria-label="label" class="flex flex-1 flex-col gap-5 overflow-y-auto px-3 py-3">
      <slot />
    </nav>
    <div v-if="$slots.footer" class="border-t border-line px-3 py-3">
      <slot name="footer" />
    </div>
  </div>
</template>
