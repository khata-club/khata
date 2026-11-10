<script setup lang="ts">
import { Toggle } from 'reka-ui'
import { onBeforeUnmount, ref } from 'vue'

import { cn } from '../lib/cn'

const {
  label,
  disabled = false,
  class: className,
} = defineProps<{
  /** Accessible name: the button only shows an icon. */
  label: string
  disabled?: boolean
  class?: string
}>()

/** Pressed state (`aria-pressed`). */
const pressed = defineModel<boolean>({ default: false })

const POP_MS = 160

// Brief pop when the user presses it, like a "like" button (not on programmatic changes).
const pop = ref(false)
let popTimer: ReturnType<typeof setTimeout> | undefined
function onToggle(value: boolean) {
  pressed.value = value
  pop.value = true
  clearTimeout(popTimer)
  popTimer = setTimeout(() => (pop.value = false), POP_MS)
}
onBeforeUnmount(() => clearTimeout(popTimer))
</script>

<template>
  <!-- Disabled classes come after the "on" ones, with compound variants, so a pressed toggle
       still looks disabled. -->
  <Toggle
    :model-value="pressed"
    :disabled="disabled"
    :aria-label="label"
    data-slot="toggle-button"
    :class="
      cn(
        'inline-flex size-12 cursor-pointer items-center justify-center rounded-full border border-line bg-surface text-fg shadow-raised-sm transition-[scale,background-color,color,border-color] duration-(--duration-normal) ease-standard [&_svg]:size-[22px]',
        'data-[state=on]:border-danger-border data-[state=on]:bg-danger-subtle data-[state=on]:text-danger',
        'data-[disabled]:cursor-not-allowed data-[disabled]:text-fg-disabled data-[disabled]:shadow-none',
        'data-[disabled]:data-[state=on]:border-line data-[disabled]:data-[state=on]:bg-surface-recessed data-[disabled]:data-[state=on]:text-fg-disabled',
        pop && 'scale-[1.12]',
        className,
      )
    "
    @update:model-value="onToggle"
  >
    <slot :pressed="pressed" />
  </Toggle>
</template>
