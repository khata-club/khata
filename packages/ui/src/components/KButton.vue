<script setup lang="ts">
import { Primitive, type PrimitiveProps } from 'reka-ui'
import { computed } from 'vue'

import { cn } from '../lib/cn'
import { buttonVariants, type ButtonVariants } from './button'
import KSpinner from './KSpinner.vue'

interface Props extends PrimitiveProps {
  variant?: ButtonVariants['variant']
  size?: ButtonVariants['size']
  /** Square, round button holding only an icon. Give it an `aria-label`. */
  iconOnly?: boolean
  /** Shows a spinner, sets `aria-busy` and blocks activation by mouse and keyboard. */
  loading?: boolean
  type?: 'button' | 'submit' | 'reset'
  /** Works for links and `asChild` too: they get `aria-disabled`, leave the tab order and ignore clicks. */
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

/** A real <button>: gets `type` and the native `disabled` attribute. */
const isNativeButton = computed(() => !asChild && as === 'button')

// Capture phase, so it runs before any click listener the parent attached. preventDefault also
// stops form submission (Enter/Space on a submit button) and link navigation.
function blockWhenInactive(event: MouseEvent) {
  if (!disabled && !loading) return
  event.preventDefault()
  event.stopImmediatePropagation()
}
</script>

<template>
  <Primitive
    :as="as"
    :as-child="asChild"
    :type="isNativeButton ? type : undefined"
    :disabled="isNativeButton && disabled ? true : undefined"
    :aria-disabled="(!isNativeButton && disabled) || loading ? true : undefined"
    :tabindex="!isNativeButton && disabled ? -1 : undefined"
    :data-disabled="disabled ? '' : undefined"
    :aria-busy="loading || undefined"
    data-slot="button"
    :class="
      cn(buttonVariants({ variant, size, iconOnly }), loading && 'pointer-events-none', className)
    "
    @click.capture="blockWhenInactive"
  >
    <KSpinner v-if="loading" />
    <slot />
  </Primitive>
</template>
