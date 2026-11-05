<script setup lang="ts">
import { cn } from '../lib/cn'

defineOptions({ inheritAttrs: false })

const {
  invalid = false,
  disabled = false,
  readonly = false,
  class: className,
} = defineProps<{
  /** Error styling; also sets `aria-invalid`. */
  invalid?: boolean
  disabled?: boolean
  readonly?: boolean
  class?: string
}>()

const model = defineModel<string>()
</script>

<template>
  <input
    v-model="model"
    v-bind="$attrs"
    :disabled="disabled"
    :readonly="readonly"
    :aria-invalid="invalid || undefined"
    data-slot="input"
    :class="
      cn(
        'h-[52px] w-full min-w-0 rounded-md border border-line-control bg-surface-subtle px-4 text-base text-fg shadow-recessed transition-[border-color,box-shadow,background-color] duration-(--duration-normal) ease-standard outline-none',
        'hover:border-gray-600 focus:border-primary focus:bg-surface focus:shadow-recessed-focus',
        invalid &&
          'border-[1.5px] border-danger bg-surface hover:border-danger focus:border-danger focus:shadow-recessed-danger-focus',
        readonly && !invalid && 'bg-surface-recessed hover:border-line-control',
        'disabled:cursor-not-allowed disabled:border-dashed disabled:border-line-control disabled:bg-surface-recessed disabled:text-fg-disabled disabled:shadow-none',
        className,
      )
    "
  />
</template>
