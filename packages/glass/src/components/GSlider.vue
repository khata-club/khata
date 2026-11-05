<script setup lang="ts">
import { SliderRange, SliderRoot, SliderThumb, SliderTrack } from 'reka-ui'
import { computed } from 'vue'

import { cn } from '../lib/cn'

const {
  label,
  min = 0,
  max = 100,
  step = 1,
  disabled = false,
  class: className,
} = defineProps<{
  /** Accessible name for the thumb. */
  label: string
  min?: number
  max?: number
  step?: number
  disabled?: boolean
  class?: string
}>()

const model = defineModel<number>({ default: 0 })
const value = computed({
  get: () => [model.value],
  set: (v: number[] | undefined) => {
    if (v?.[0] != null) model.value = v[0]
  },
})
</script>

<template>
  <SliderRoot
    v-model="value"
    :min="min"
    :max="max"
    :step="step"
    :disabled="disabled"
    data-slot="slider"
    :class="
      cn(
        'group relative flex h-(--touch-target) w-full cursor-pointer touch-none items-center select-none data-[disabled]:cursor-not-allowed data-[disabled]:opacity-40',
        className,
      )
    "
  >
    <SliderTrack class="relative h-1.5 grow overflow-hidden rounded-full bg-fill">
      <SliderRange class="absolute h-full rounded-full bg-accent" />
    </SliderTrack>
    <!-- While held, the thumb swells into a clear glass lens over the track. -->
    <SliderThumb
      :aria-label="label"
      class="block h-6 w-[38px] rounded-full bg-white shadow-thumb transition-[scale,background-color,box-shadow] duration-(--duration-spring) ease-bouncy group-active:scale-[1.3] group-active:bg-white/30 group-active:shadow-[inset_1px_1px_0_-0.5px_rgb(255_255_255/0.9),inset_0_0_0_0.5px_rgb(255_255_255/0.5),0_4px_12px_rgb(0_0_0/0.15)] group-active:backdrop-blur-[2px] focus-visible:outline-offset-4"
    />
  </SliderRoot>
</template>
