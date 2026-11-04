<script setup lang="ts">
import { RadioGroupIndicator, RadioGroupItem } from 'reka-ui'

import { cn } from '../lib/cn'

const {
  value,
  disabled = false,
  id,
  class: className,
} = defineProps<{
  value: string
  disabled?: boolean
  id?: string
  class?: string
}>()
</script>

<template>
  <RadioGroupItem
    :id="id"
    :value="value"
    :disabled="disabled"
    data-slot="radio"
    :class="
      cn(
        'group flex min-h-(--touch-target) cursor-pointer items-center gap-3 rounded-full border-0 bg-transparent p-0 text-left text-base text-fg data-[disabled]:cursor-not-allowed data-[disabled]:text-fg-disabled',
        className,
      )
    "
  >
    <span
      class="grid size-6 flex-none place-items-center rounded-full border-[1.5px] border-line-control bg-surface shadow-recessed transition-[border-color,box-shadow] duration-(--duration-normal) ease-standard group-data-[disabled]:border-gray-300 group-data-[disabled]:bg-surface-recessed group-data-[disabled]:shadow-none group-data-[state=checked]:border-primary group-data-[disabled]:group-data-[state=checked]:border-gray-300"
    >
      <RadioGroupIndicator
        force-mount
        class="size-3 scale-0 rounded-full bg-primary transition-transform duration-(--duration-slow) ease-standard group-data-[disabled]:bg-gray-400 data-[state=checked]:scale-100"
      />
    </span>
    <span v-if="$slots.default"><slot /></span>
  </RadioGroupItem>
</template>
