<script setup lang="ts">
import { cn } from '../lib/cn'

const { class: className } = defineProps<{ class?: string }>()
</script>

<template>
  <!-- Overlapping stack: each avatar after the first tucks under its neighbour. -->
  <span
    data-slot="avatar-group"
    :class="cn('flex [&>*]:ring-2 [&>*]:ring-surface [&>*+*]:-ml-1.5', className)"
  >
    <slot />
  </span>
</template>
