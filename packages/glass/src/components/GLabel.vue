<script setup lang="ts">
import { Label } from 'reka-ui'

import { cn } from '../lib/cn'

const {
  for: htmlFor,
  required = false,
  optional = false,
  disabled = false,
  class: className,
} = defineProps<{
  for?: string
  /** Shows an asterisk. Mark the control itself `required`/`aria-required` for screen readers. */
  required?: boolean
  /** Shows a quiet "Optional" hint instead of an asterisk. */
  optional?: boolean
  disabled?: boolean
  class?: string
}>()
</script>

<template>
  <Label
    :for="htmlFor"
    data-slot="label"
    :class="
      cn(
        'inline-flex items-baseline gap-1.5 text-subhead font-medium text-label',
        disabled && 'opacity-50',
        className,
      )
    "
  >
    <slot />
    <span v-if="required" aria-hidden="true" class="text-negative">*</span>
    <span v-else-if="optional" class="text-footnote font-normal text-label-secondary">
      Optional
    </span>
  </Label>
</template>
