<script setup lang="ts">
import { SplitterGroup } from 'reka-ui'

import { cn } from '../lib/cn'

/**
 * Resizable panel group. Put `KSplitterPanel`s and `KSplitterHandle`s inside. With `autoSaveId`
 * the layout is remembered in localStorage.
 */
const {
  direction = 'horizontal',
  autoSaveId,
  class: className,
} = defineProps<{
  direction?: 'horizontal' | 'vertical'
  autoSaveId?: string
  class?: string
}>()
</script>

<template>
  <SplitterGroup
    :direction="direction"
    :auto-save-id="autoSaveId"
    data-slot="splitter"
    :class="cn('flex h-full w-full', direction === 'vertical' && 'flex-col', className)"
  >
    <slot />
  </SplitterGroup>
</template>
