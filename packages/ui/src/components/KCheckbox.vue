<script setup lang="ts">
import { CheckboxRoot } from 'reka-ui'

import { cn } from '../lib/cn'
import { choiceRootClass } from './choice'

const {
  disabled = false,
  invalid = false,
  name,
  value,
  id,
  class: className,
} = defineProps<{
  disabled?: boolean
  /** Error state: red ring and tint (also sets aria-invalid). */
  invalid?: boolean
  name?: string
  value?: string
  id?: string
  class?: string
}>()

/** `true`, `false` or `'indeterminate'` (renders a dash, `aria-checked="mixed"`). */
const checked = defineModel<boolean | 'indeterminate'>({ default: false })
</script>

<template>
  <CheckboxRoot
    :id="id"
    v-model="checked"
    :disabled="disabled"
    :name="name"
    :value="value"
    :aria-invalid="invalid || undefined"
    :data-invalid="invalid || undefined"
    data-slot="checkbox"
    :class="cn(choiceRootClass, className)"
  >
    <!-- Checked and indeterminate share one look (`not-data-[state=unchecked]`). Invalid uses the
         low-specificity `in-data-[invalid]` so checked and disabled always outrank it. -->
    <span
      class="grid size-6 flex-none place-items-center rounded-sm border-[1.5px] border-line-control bg-surface shadow-recessed transition-[background-color,border-color,box-shadow] duration-(--duration-normal) ease-standard group-not-data-[state=unchecked]:border-primary group-not-data-[state=unchecked]:bg-primary group-not-data-[state=unchecked]:shadow-primary-sm group-data-[disabled]:border-dashed group-data-[disabled]:border-line-control group-data-[disabled]:bg-surface-recessed group-data-[disabled]:shadow-none group-data-[disabled]:group-not-data-[state=unchecked]:border-solid group-data-[disabled]:group-not-data-[state=unchecked]:border-control-disabled group-data-[disabled]:group-not-data-[state=unchecked]:bg-control-disabled group-data-[disabled]:group-not-data-[state=unchecked]:shadow-none in-data-[invalid]:border-danger in-data-[invalid]:bg-danger-subtle"
    >
      <!-- Tick draws left-to-right via clip-path; dash grows for the mixed state. -->
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        class="col-start-1 row-start-1 size-4 fill-none stroke-on-primary stroke-3 transition-[clip-path] duration-(--duration-slow) ease-standard [clip-path:inset(0_100%_0_0)] group-data-[state=checked]:[clip-path:inset(0_0_0_0)]"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <path d="M20 6 9 17l-5-5" />
      </svg>
      <span
        aria-hidden="true"
        class="col-start-1 row-start-1 h-[2.5px] w-[11px] scale-x-0 rounded-[2px] bg-on-primary transition-[scale] duration-(--duration-normal) ease-standard group-data-[state=indeterminate]:scale-x-100"
      />
    </span>
    <span v-if="$slots.default"><slot /></span>
  </CheckboxRoot>
</template>
