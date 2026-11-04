<script setup lang="ts">
import { cn } from '../lib/cn'

const { class: className } = defineProps<{ class?: string }>()
</script>

<template>
  <!-- Overlapping stack: each avatar after the first tucks 12px under its neighbour. -->
  <span
    data-slot="avatar-group"
    :class="cn('flex [&>*]:border-2 [&>*]:border-white [&>*+*]:-ml-3', className)"
  >
    <slot />
  </span>
</template>
