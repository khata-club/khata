<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'

import { cn } from '../lib/cn'

const {
  title,
  large = true,
  class: className,
} = defineProps<{
  title: string
  /** Show a large title under the bar that hands over to the inline title on scroll. */
  large?: boolean
  class?: string
}>()

defineSlots<{ leading?(): unknown; trailing?(): unknown; default?(): unknown }>()

// The bar is clear at the top of the page and turns to glass once content scrolls beneath it
// (for a large title: once the title has scrolled under the bar, which then shows it inline).
const scrolled = ref(false)
const sentinel = ref<HTMLElement>()
let io: IntersectionObserver | undefined
onMounted(() => {
  if (!sentinel.value || typeof IntersectionObserver === 'undefined') return
  io = new IntersectionObserver(([e]) => (scrolled.value = !e!.isIntersecting), {
    rootMargin: '-56px 0px 0px 0px',
  })
  io.observe(sentinel.value)
})
onBeforeUnmount(() => io?.disconnect())
</script>

<template>
  <header
    data-slot="nav-bar"
    :data-scrolled="scrolled || undefined"
    :class="cn('sticky top-0 z-40', className)"
  >
    <div
      :class="[
        'grid h-14 grid-cols-[1fr_auto_1fr] items-center gap-3 px-4 transition-[background-color,box-shadow,backdrop-filter] duration-(--duration-slow) ease-out',
        scrolled ? 'glass-regular' : 'bg-transparent',
      ]"
    >
      <div class="flex min-w-0 items-center gap-2 justify-self-start"><slot name="leading" /></div>
      <span
        :class="[
          'truncate text-body font-semibold transition-[opacity,translate] duration-(--duration-slow) ease-smooth',
          large && !scrolled ? 'translate-y-1 opacity-0' : 'translate-y-0 opacity-100',
        ]"
        :aria-hidden="large && !scrolled ? true : undefined"
      >
        {{ title }}
      </span>
      <div class="flex min-w-0 items-center gap-2 justify-self-end"><slot name="trailing" /></div>
    </div>
  </header>
  <div v-if="!large" ref="sentinel" aria-hidden="true" class="h-px" />
  <h1
    v-if="large"
    :class="[
      'm-0 px-4 pt-1 pb-2 text-large-title font-bold transition-opacity duration-(--duration-normal)',
      scrolled && 'opacity-0',
    ]"
  >
    {{ title }}
  </h1>
  <div v-if="large" ref="sentinel" aria-hidden="true" class="h-px" />
  <slot />
</template>
