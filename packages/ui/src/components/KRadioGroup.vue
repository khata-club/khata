<script setup lang="ts">
import { RadioGroupRoot } from 'reka-ui'

import { cn } from '../lib/cn'

const {
  disabled = false,
  name,
  orientation = 'vertical',
  class: className,
} = defineProps<{
  disabled?: boolean
  name?: string
  orientation?: 'vertical' | 'horizontal'
  class?: string
}>()

const value = defineModel<string>()
</script>

<template>
  <!-- Reka gives radio semantics: one Tab stop, arrow keys move the selection. -->
  <RadioGroupRoot
    v-model="value"
    :disabled="disabled"
    :name="name"
    :orientation="orientation"
    data-slot="radio-group"
    :class="cn('flex', orientation === 'vertical' ? 'flex-col' : 'flex-wrap gap-6', className)"
  >
    <slot />
  </RadioGroupRoot>
</template>
