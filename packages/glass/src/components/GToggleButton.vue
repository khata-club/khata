<script setup lang="ts">
import { Toggle } from 'reka-ui'
import { ref, watch } from 'vue'

import { cn } from '../lib/cn'

const { disabled = false, class: className } = defineProps<{
  disabled?: boolean
  class?: string
}>()

/** Pressed state (`aria-pressed`). */
const pressed = defineModel<boolean>({ default: false })

// A brief swell when toggled; the bouncy spring settles it back.
const pop = ref(false)
watch(pressed, () => {
  pop.value = true
  setTimeout(() => (pop.value = false), 140)
})
</script>

<template>
  <Toggle
    v-model="pressed"
    :disabled="disabled"
    data-slot="toggle-button"
    :class="
      cn(
        'inline-flex size-11 cursor-pointer items-center justify-center rounded-full glass-thin text-label transition-[scale,color,background-color] duration-(--duration-spring) ease-bouncy [&_svg]:size-5',
        'active:scale-[0.92] active:duration-(--duration-fast)',
        'data-[state=on]:text-pink [&[data-state=on]_svg]:fill-current',
        'disabled:cursor-not-allowed disabled:opacity-40',
        pop && 'scale-[1.14] duration-(--duration-fast)',
        className,
      )
    "
  >
    <slot :pressed="pressed" />
  </Toggle>
</template>
