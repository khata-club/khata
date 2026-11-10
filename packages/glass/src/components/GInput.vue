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
  <!-- A filled, borderless field. Focus lifts it onto the surface with an accent ring. -->
  <input
    v-model="model"
    v-bind="$attrs"
    :disabled="disabled"
    :readonly="readonly"
    :aria-invalid="invalid || undefined"
    data-slot="input"
    :class="
      cn(
        'h-11 w-full min-w-0 rounded-md border-0 bg-fill-tertiary px-4 text-body text-label outline-none',
        'transition-[background-color,box-shadow] duration-(--duration-normal) ease-out',
        'hover:bg-fill-secondary focus:bg-surface focus:shadow-[0_0_0_1px_var(--color-tint),0_0_0_4px_var(--color-accent-soft)]',
        invalid &&
          'shadow-[inset_0_0_0_1.5px_var(--color-negative)] focus:shadow-[0_0_0_1px_var(--color-negative),0_0_0_4px_var(--color-negative-soft)]',
        readonly &&
          'bg-transparent shadow-[inset_0_0_0_1px_var(--color-separator)] hover:bg-transparent',
        'disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-fill-tertiary',
        className,
      )
    "
  />
</template>
