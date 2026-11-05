<script setup lang="ts">
import { RadioGroupIndicator, RadioGroupItem } from 'reka-ui'

import { cn } from '../lib/cn'

const {
  value,
  disabled = false,
  invalid = false,
  id,
  class: className,
} = defineProps<{
  value: string
  disabled?: boolean
  /** Error state: red outline (also sets aria-invalid). */
  invalid?: boolean
  id?: string
  class?: string
}>()
</script>

<template>
  <RadioGroupItem
    :id="id"
    :value="value"
    :disabled="disabled"
    :aria-invalid="invalid || undefined"
    :data-invalid="invalid || undefined"
    data-slot="radio"
    :class="
      cn(
        'group flex min-h-(--touch-target) cursor-pointer items-center gap-3 border-0 bg-transparent p-0 text-left text-body text-label data-[disabled]:cursor-not-allowed data-[disabled]:opacity-40',
        className,
      )
    "
  >
    <span
      class="grid size-[22px] flex-none place-items-center rounded-full bg-surface shadow-[inset_0_0_0_1.5px_var(--color-control)] transition-[background-color,box-shadow,scale] duration-(--duration-spring) ease-bouncy group-active:scale-[0.88] group-active:duration-(--duration-fast) group-data-[invalid]:shadow-[inset_0_0_0_1.5px_var(--color-negative)] group-data-[state=checked]:bg-accent group-data-[state=checked]:shadow-none"
    >
      <RadioGroupIndicator
        force-mount
        class="size-2 scale-0 rounded-full bg-white transition-transform duration-(--duration-spring) ease-bouncy data-[state=checked]:scale-100"
      />
    </span>
    <span v-if="$slots.default"><slot /></span>
  </RadioGroupItem>
</template>
