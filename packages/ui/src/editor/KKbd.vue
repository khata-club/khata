<script setup lang="ts">
import { cn } from '../lib/cn'

const { class: className } = defineProps<{ class?: string }>()
</script>

<template>
  <kbd
    data-slot="kbd"
    :class="
      cn(
        'inline-flex h-5 min-w-5 items-center justify-center rounded-[5px] border border-line bg-surface-subtle px-1 font-mono text-[11px] leading-none text-fg-muted shadow-[0_1px_0_var(--color-line)]',
        className,
      )
    "
    ><slot
  /></kbd>
</template>
