<script setup lang="ts">
import { Separator } from 'reka-ui'

import { cn } from '../lib/cn'

const {
  orientation = 'horizontal',
  decorative = false,
  class: className,
} = defineProps<{
  orientation?: 'horizontal' | 'vertical'
  /** Purely visual: hidden from assistive tech. */
  decorative?: boolean
  class?: string
}>()
</script>

<template>
  <Separator
    :orientation="orientation"
    :decorative="decorative"
    data-slot="divider"
    :class="
      cn(
        'shrink-0 bg-line',
        orientation === 'horizontal' ? 'h-px w-full' : 'h-5 w-px self-center',
        className,
      )
    "
  />
</template>
