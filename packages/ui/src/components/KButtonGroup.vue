<script setup lang="ts">
import { cn } from '../lib/cn'

const { label, class: className } = defineProps<{
  /** Accessible name for the group of related actions. */
  label: string
  class?: string
}>()
</script>

<template>
  <div
    role="group"
    :aria-label="label"
    data-slot="button-group"
    :class="cn('flex flex-wrap gap-3', className)"
  >
    <slot />
  </div>
</template>
