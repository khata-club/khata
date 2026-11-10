<script setup lang="ts">
import { Label } from 'reka-ui'

import { cn } from '../lib/cn'

const {
  for: htmlFor,
  required = false,
  optional = false,
  disabled = false,
  optionalText = 'Optional',
  class: className,
} = defineProps<{
  for?: string
  /** Shows a red asterisk. Mark the control itself `required`/`aria-required` for screen readers. */
  required?: boolean
  /** Shows a muted "Optional" hint instead of an asterisk. */
  optional?: boolean
  disabled?: boolean
  /** Text of the optional hint. */
  optionalText?: string
  class?: string
}>()
</script>

<template>
  <Label
    :for="htmlFor"
    data-slot="label"
    :data-disabled="disabled || undefined"
    :class="
      cn(
        'inline-flex items-baseline gap-1 text-sm font-semibold text-fg data-[disabled]:text-fg-disabled',
        className,
      )
    "
  >
    <slot />
    <span v-if="required" aria-hidden="true" class="text-danger">*</span>
    <span v-else-if="optional" class="text-xs font-medium text-fg-muted">{{ optionalText }}</span>
  </Label>
</template>
