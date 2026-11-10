<script setup lang="ts">
import { RadioGroupItem, RadioGroupRoot } from 'reka-ui'

import { cn } from '../lib/cn'
import type { ChoiceOption } from './option'

/** Alias of the shared `ChoiceOption`. */
export type SegmentedOption = ChoiceOption

const {
  options,
  label,
  size = 'md',
  disabled = false,
  class: className,
} = defineProps<{
  options: SegmentedOption[]
  /** Accessible name for the group. */
  label: string
  size?: 'sm' | 'md'
  disabled?: boolean
  class?: string
}>()

const value = defineModel<string>()
</script>

<template>
  <!-- Single choice with radio semantics: one Tab stop, arrow keys move the selection.
       The active segment gets a 1.5px primary border so it is not marked by colour alone. -->
  <RadioGroupRoot
    v-model="value"
    :aria-label="label"
    :disabled="disabled"
    orientation="horizontal"
    loop
    data-slot="segmented-control"
    :class="cn('inline-flex gap-1 rounded-full bg-surface-recessed p-1 shadow-recessed', className)"
  >
    <RadioGroupItem
      v-for="o in options"
      :key="o.value"
      :value="o.value"
      :disabled="o.disabled"
      :class="
        cn(
          'cursor-pointer rounded-full border-[1.5px] border-transparent bg-transparent px-3 font-semibold whitespace-nowrap text-fg-muted transition-[background-color,box-shadow,color,border-color] duration-(--duration-normal) ease-standard',
          'hover:text-fg data-[state=checked]:border-primary data-[state=checked]:bg-surface data-[state=checked]:text-primary data-[state=checked]:shadow-raised-sm',
          'data-[disabled]:cursor-not-allowed data-[disabled]:text-fg-disabled',
          size === 'sm' ? 'h-[30px] text-xs' : 'h-8 min-w-[52px] text-sm',
        )
      "
    >
      {{ o.label }}
    </RadioGroupItem>
  </RadioGroupRoot>
</template>
