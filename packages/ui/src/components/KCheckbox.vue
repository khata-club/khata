<script setup lang="ts">
import { CheckboxRoot } from 'reka-ui'

import { cn } from '../lib/cn'

const {
  disabled = false,
  name,
  value,
  id,
  class: className,
} = defineProps<{
  disabled?: boolean
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
    data-slot="checkbox"
    :class="
      cn(
        'group flex min-h-(--touch-target) cursor-pointer items-center gap-3 rounded-sm border-0 bg-transparent p-0 text-left text-base text-fg data-[disabled]:cursor-not-allowed data-[disabled]:text-fg-disabled',
        className,
      )
    "
  >
    <span
      class="grid size-6 flex-none place-items-center rounded-sm border-[1.5px] border-line-control bg-surface shadow-recessed transition-[background-color,border-color,box-shadow] duration-(--duration-normal) ease-standard group-data-[disabled]:border-gray-300 group-data-[disabled]:bg-gray-300 group-data-[disabled]:shadow-none group-data-[state=checked]:border-primary group-data-[state=checked]:bg-primary group-data-[state=checked]:shadow-primary-sm group-data-[disabled]:group-data-[state=checked]:border-gray-300 group-data-[disabled]:group-data-[state=checked]:bg-gray-300 group-data-[disabled]:group-data-[state=checked]:shadow-none group-data-[state=indeterminate]:border-primary group-data-[state=indeterminate]:bg-primary group-data-[state=indeterminate]:shadow-primary-sm group-data-[disabled]:group-data-[state=indeterminate]:border-gray-300 group-data-[disabled]:group-data-[state=indeterminate]:bg-gray-300"
    >
      <!-- Tick draws left-to-right via clip-path; dash grows for the mixed state. -->
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        class="col-start-1 row-start-1 size-4 fill-none stroke-white stroke-3 transition-[clip-path] duration-(--duration-slow) ease-standard [clip-path:inset(0_100%_0_0)] group-data-[state=checked]:[clip-path:inset(0_0_0_0)]"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <path d="M20 6 9 17l-5-5" />
      </svg>
      <span
        aria-hidden="true"
        class="col-start-1 row-start-1 h-[2.5px] w-[11px] scale-x-0 rounded-[2px] bg-white transition-transform duration-(--duration-normal) ease-standard group-data-[state=indeterminate]:scale-x-100"
      />
    </span>
    <span v-if="$slots.default"><slot /></span>
  </CheckboxRoot>
</template>
