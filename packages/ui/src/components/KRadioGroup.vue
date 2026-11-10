<script setup lang="ts">
import { RadioGroupRoot } from 'reka-ui'

import { cn } from '../lib/cn'

const {
  label,
  disabled = false,
  required = false,
  invalid = false,
  name,
  orientation = 'vertical',
  class: className,
} = defineProps<{
  /** Accessible name. Omit only when the group is named another way (`aria-labelledby`). */
  label?: string
  disabled?: boolean
  required?: boolean
  /** Error state: every radio shows the red ring; `aria-invalid` is set on the group. */
  invalid?: boolean
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
    :aria-label="label"
    :disabled="disabled"
    :required="required"
    :name="name"
    :orientation="orientation"
    :aria-invalid="invalid || undefined"
    :data-invalid="invalid || undefined"
    data-slot="radio-group"
    :class="cn('flex', orientation === 'vertical' ? 'flex-col' : 'flex-wrap gap-6', className)"
  >
    <slot />
  </RadioGroupRoot>
</template>
