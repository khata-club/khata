<script setup lang="ts">
import { Separator } from 'reka-ui'

import { cn } from '../lib/cn'

const {
  orientation = 'horizontal',
  decorative = false,
  inset = false,
  class: className,
} = defineProps<{
  orientation?: 'horizontal' | 'vertical'
  /** Purely visual: hidden from assistive tech. */
  decorative?: boolean
  /** Starts after a 16px leading inset, like separators between list rows. */
  inset?: boolean
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
        'shrink-0 bg-separator',
        orientation === 'horizontal' ? 'h-px w-full' : 'h-full w-px self-stretch',
        inset && orientation === 'horizontal' && 'ml-4 w-[calc(100%-16px)]',
        className,
      )
    "
  />
</template>
