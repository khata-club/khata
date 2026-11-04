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

// Brief pop when pressed, like a "like" button.
const pop = ref(false)
watch(pressed, () => {
  pop.value = true
  setTimeout(() => (pop.value = false), 160)
})
</script>

<template>
  <Toggle
    v-model="pressed"
    :disabled="disabled"
    data-slot="toggle-button"
    :class="
      cn(
        'inline-flex size-12 cursor-pointer items-center justify-center rounded-full border border-line bg-surface text-fg shadow-raised-sm transition-[transform,background-color,color,border-color] duration-(--duration-normal) ease-standard [&_svg]:size-[22px]',
        'data-[state=on]:border-danger-border data-[state=on]:bg-danger-subtle data-[state=on]:text-danger',
        'disabled:cursor-not-allowed disabled:text-fg-disabled disabled:shadow-none',
        pop && 'scale-[1.12]',
        className,
      )
    "
  >
    <slot :pressed="pressed" />
  </Toggle>
</template>
