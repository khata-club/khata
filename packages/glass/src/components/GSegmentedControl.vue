<script setup lang="ts">
import { RadioGroupItem, RadioGroupRoot } from 'reka-ui'
import { ref } from 'vue'

import { useSlidingIndicator } from '../composables/useSlidingIndicator'
import { cn } from '../lib/cn'

export interface SegmentedOption {
  value: string
  label: string
  disabled?: boolean
}

const {
  options,
  label,
  size = 'md',
  variant = 'filled',
  disabled = false,
  class: className,
} = defineProps<{
  options: SegmentedOption[]
  /** Accessible name for the group. */
  label: string
  size?: 'sm' | 'md'
  /** `glass` for a control floating over content; `filled` on a surface. */
  variant?: 'filled' | 'glass'
  disabled?: boolean
  class?: string
}>()

const value = defineModel<string>()
const root = ref()
const { style: thumb, moving } = useSlidingIndicator(root, '[data-state=checked]')
</script>

<template>
  <!-- Radio semantics: one Tab stop, arrow keys move the selection. The thumb is a separate
       element that springs between segments and swells slightly while it travels. -->
  <RadioGroupRoot
    ref="root"
    v-model="value"
    :aria-label="label"
    :disabled="disabled"
    orientation="horizontal"
    loop
    data-slot="segmented-control"
    :class="
      cn(
        'relative isolate inline-grid auto-cols-fr grid-flow-col rounded-full p-0.5',
        variant === 'glass' ? 'glass-thin' : 'bg-fill-tertiary',
        disabled && 'opacity-40',
        className,
      )
    "
  >
    <span
      aria-hidden="true"
      :style="thumb"
      :class="[
        'absolute top-0 left-0 -z-1 rounded-full bg-white shadow-[0_3px_8px_rgb(0_0_0/0.12),0_0.5px_1.5px_rgb(0_0_0/0.1)] dark:bg-gray-2',
        'transition-[transform,width,scale] duration-(--duration-spring) ease-snappy',
        moving && 'scale-[1.06]',
      ]"
    />
    <RadioGroupItem
      v-for="o in options"
      :key="o.value"
      :value="o.value"
      :disabled="o.disabled"
      :class="
        cn(
          'cursor-pointer rounded-full border-0 bg-transparent px-3.5 font-medium whitespace-nowrap text-label transition-[color,opacity,scale] duration-(--duration-normal) ease-out',
          'active:scale-[0.96] data-[disabled]:cursor-not-allowed data-[disabled]:opacity-40 data-[state=checked]:font-semibold',
          size === 'sm' ? 'h-7 text-footnote' : 'h-8 min-w-[56px] text-subhead',
        )
      "
    >
      {{ o.label }}
    </RadioGroupItem>
  </RadioGroupRoot>
</template>
