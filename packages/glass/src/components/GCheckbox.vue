<script setup lang="ts">
import { CheckboxRoot } from 'reka-ui'

import { cn } from '../lib/cn'

const {
  disabled = false,
  invalid = false,
  name,
  value,
  id,
  class: className,
} = defineProps<{
  disabled?: boolean
  /** Error state: red outline (also sets aria-invalid). */
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
    :class="
      cn(
        'group flex min-h-(--touch-target) cursor-pointer items-center gap-3 border-0 bg-transparent p-0 text-left text-body text-label data-[disabled]:cursor-not-allowed data-[disabled]:opacity-40',
        className,
      )
    "
  >
    <!-- The box squeezes while pressed and springs back as it fills. -->
    <span
      class="grid size-[22px] flex-none place-items-center rounded-[7px] bg-surface shadow-[inset_0_0_0_1.5px_var(--color-control)] transition-[background-color,box-shadow,scale] duration-(--duration-spring) ease-bouncy group-active:scale-[0.88] group-active:duration-(--duration-fast) group-data-[invalid]:shadow-[inset_0_0_0_1.5px_var(--color-negative)] group-data-[state=checked]:bg-accent group-data-[state=checked]:shadow-none group-data-[state=indeterminate]:bg-accent group-data-[state=indeterminate]:shadow-none"
    >
      <!-- The tick draws itself; the dash grows for the mixed state. -->
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        class="col-start-1 row-start-1 size-4 fill-none stroke-white stroke-3 transition-[stroke-dashoffset] duration-(--duration-slow) ease-out [stroke-dasharray:1] [stroke-dashoffset:1] group-data-[state=checked]:[stroke-dashoffset:0]"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <path d="M5 12.5 10 17.5 19 7" pathLength="1" />
      </svg>
      <span
        aria-hidden="true"
        class="col-start-1 row-start-1 h-[2.5px] w-[11px] scale-x-0 rounded-full bg-white transition-transform duration-(--duration-normal) ease-snappy group-data-[state=indeterminate]:scale-x-100"
      />
    </span>
    <span v-if="$slots.default"><slot /></span>
  </CheckboxRoot>
</template>
