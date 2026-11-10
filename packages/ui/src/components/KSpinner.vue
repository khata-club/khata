<script setup lang="ts">
import { cn } from '../lib/cn'

const { class: className } = defineProps<{ class?: string }>()
</script>

<template>
  <span
    aria-hidden="true"
    :class="
      cn(
        'inline-block size-4 shrink-0 animate-ck-spin rounded-full border-2 border-current/35 border-t-current',
        className,
      )
    "
  />
</template>
