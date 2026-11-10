<script setup lang="ts">
import { SplitterResizeHandle } from 'reka-ui'

import { cn } from '../lib/cn'

const { label = 'Resize', class: className } = defineProps<{ label?: string; class?: string }>()
</script>

<template>
  <SplitterResizeHandle
    :aria-label="label"
    data-slot="splitter-handle"
    :class="
      cn(
        'relative flex-none bg-line outline-hidden transition-colors duration-(--duration-fast) hover:bg-primary-accent focus-visible:bg-primary data-[state=drag]:bg-primary',
        'data-[orientation=horizontal]:w-px data-[orientation=vertical]:h-px',
        // Wider invisible hit area.
        'after:absolute after:-inset-x-1 after:inset-y-0 data-[orientation=vertical]:after:inset-x-0 data-[orientation=vertical]:after:-inset-y-1',
        className,
      )
    "
  />
</template>
