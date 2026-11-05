<script setup lang="ts">
import { SliderRange, SliderRoot, SliderThumb, SliderTrack } from 'reka-ui'
import { computed } from 'vue'

import { cn } from '../lib/cn'

const {
  min = 0,
  max = 100,
  step = 1,
  disabled = false,
  label,
  class: className,
} = defineProps<{
  min?: number
  max?: number
  step?: number
  disabled?: boolean
  /** Accessible name for the thumb. */
  label?: string
  class?: string
}>()

const value = defineModel<number>({ default: 0 })
const emit = defineEmits<{ commit: [value: number] }>()

// Reka works with arrays (multi-thumb); this is a single-value slider.
const arr = computed({
  get: () => [value.value],
  set: (v: number[]) => {
    if (v[0] !== undefined) value.value = v[0]
  },
})
</script>

<template>
  <SliderRoot
    v-model="arr"
    :min="min"
    :max="max"
    :step="step"
    :disabled="disabled"
    data-slot="slider"
    :class="
      cn(
        'relative flex h-5 w-full touch-none items-center select-none data-[disabled]:opacity-50',
        className,
      )
    "
    @value-commit="(v: number[]) => emit('commit', v[0] ?? value)"
  >
    <SliderTrack class="relative h-1 grow rounded-full bg-surface-recessed shadow-recessed">
      <SliderRange class="absolute h-full rounded-full bg-primary" />
    </SliderTrack>
    <SliderThumb
      :aria-label="label"
      class="block size-3.5 cursor-grab rounded-full border border-line bg-white shadow-thumb outline-none focus-visible:shadow-focus-halo active:cursor-grabbing"
    />
  </SliderRoot>
</template>
