<script setup lang="ts">
import { RadioGroupIndicator, RadioGroupItem } from 'reka-ui'

import { cn } from '../lib/cn'
import { choiceRootClass } from './choice'

const {
  value,
  disabled = false,
  invalid = false,
  id,
  class: className,
} = defineProps<{
  value: string
  disabled?: boolean
  /**
   * Visual error state for this radio only. `aria-invalid` is not valid on a radio, so to announce
   * the error set `invalid` on the KRadioGroup instead (which also styles every radio).
   */
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
    :data-invalid="invalid || undefined"
    data-slot="radio"
    :class="cn(choiceRootClass, className)"
  >
    <!-- `in-data-[invalid]` matches this radio or its group; checked and disabled outrank it. -->
    <span
      class="grid size-6 flex-none place-items-center rounded-full border-[1.5px] border-line-control bg-surface shadow-recessed transition-[border-color,box-shadow] duration-(--duration-normal) ease-standard group-data-[disabled]:border-dashed group-data-[disabled]:border-line-control group-data-[disabled]:bg-surface-recessed group-data-[disabled]:shadow-none group-data-[state=checked]:border-primary group-data-[disabled]:group-data-[state=checked]:border-solid group-data-[disabled]:group-data-[state=checked]:border-control-disabled in-data-[invalid]:border-danger in-data-[invalid]:bg-danger-subtle"
    >
      <RadioGroupIndicator
        force-mount
        class="size-3 scale-0 rounded-full bg-primary transition-[scale] duration-(--duration-slow) ease-standard group-data-[disabled]:bg-control-disabled-mark data-[state=checked]:scale-100"
      />
    </span>
    <span v-if="$slots.default"><slot /></span>
  </RadioGroupItem>
</template>
