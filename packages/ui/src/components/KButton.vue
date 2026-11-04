<script setup lang="ts">
import { Primitive, type PrimitiveProps } from 'reka-ui'

import { cn } from '../lib/cn'
import { buttonVariants, type ButtonVariants } from './button'
import KSpinner from './KSpinner.vue'

interface Props extends PrimitiveProps {
  variant?: ButtonVariants['variant']
  size?: ButtonVariants['size']
  /** Square, round button holding only an icon. Give it an `aria-label`. */
  iconOnly?: boolean
  /** Shows a spinner, sets `aria-busy` and blocks clicks. */
  loading?: boolean
  type?: 'button' | 'submit' | 'reset'
  disabled?: boolean
  class?: string
}

const {
  as = 'button',
  asChild = false,
  variant = 'primary',
  size = 'md',
  iconOnly = false,
  loading = false,
  type = 'button',
  disabled = false,
  class: className,
} = defineProps<Props>()
</script>

<template>
  <Primitive
    :as="as"
    :as-child="asChild"
    :type="as === 'button' ? type : undefined"
    :disabled="as === 'button' ? disabled : undefined"
    :aria-disabled="as !== 'button' && disabled ? true : undefined"
    :aria-busy="loading || undefined"
    data-slot="button"
    :class="
      cn(buttonVariants({ variant, size, iconOnly }), loading && 'pointer-events-none', className)
    "
  >
    <KSpinner v-if="loading" />
    <slot />
  </Primitive>
</template>
