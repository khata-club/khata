<script setup lang="ts">
import { SplitterPanel } from 'reka-ui'

import { cn } from '../lib/cn'

const {
  defaultSize,
  minSize,
  maxSize,
  id,
  order,
  class: className,
} = defineProps<{
  defaultSize?: number
  minSize?: number
  maxSize?: number
  id?: string
  order?: number
  class?: string
}>()
</script>

<template>
  <SplitterPanel
    :id="id"
    :order="order"
    :default-size="defaultSize"
    :min-size="minSize"
    :max-size="maxSize"
    data-slot="splitter-panel"
    :class="cn('min-h-0 min-w-0 overflow-hidden', className)"
  >
    <slot />
  </SplitterPanel>
</template>
