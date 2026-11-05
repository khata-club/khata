<script setup lang="ts">
import { Primitive, type PrimitiveProps } from 'reka-ui'

import { cn } from '../lib/cn'
import { buttonVariants, type ButtonVariants } from './button'
import GSpinner from './GSpinner.vue'

interface Props extends PrimitiveProps {
  variant?: ButtonVariants['variant']
  size?: ButtonVariants['size']
  /** Round button holding only an icon. Give it an `aria-label`. */
  iconOnly?: boolean
  /** Swaps the content for a spinner (width is kept), sets `aria-busy` and blocks clicks. */
  loading?: boolean
  type?: 'button' | 'submit' | 'reset'
  disabled?: boolean
  class?: string
}

const {
  as = 'button',
  asChild = false,
  variant = 'filled',
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
    <span
      :class="[
        'inline-flex items-center gap-[inherit] transition-[opacity,scale] duration-(--duration-normal) ease-smooth',
        loading && 'scale-90 opacity-0',
      ]"
    >
      <slot />
    </span>
    <GSpinner v-if="loading" class="absolute inset-0 m-auto" />
  </Primitive>
</template>
