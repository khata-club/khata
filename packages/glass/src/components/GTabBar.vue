<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, type Component } from 'vue'

import { useSlidingIndicator } from '../composables/useSlidingIndicator'
import { cn } from '../lib/cn'

export interface TabBarItem {
  value: string
  label: string
  icon: Component
  href?: string
}

const {
  items,
  label = 'Primary',
  minimizeOnScroll = false,
  class: className,
} = defineProps<{
  items: TabBarItem[]
  label?: string
  /** Shrinks to icons while the page scrolls down; expands again on scroll up. */
  minimizeOnScroll?: boolean
  class?: string
}>()

const value = defineModel<string>()
const active = computed(() => value.value ?? items[0]?.value)

const root = ref<HTMLElement>()
const { style: lens, moving } = useSlidingIndicator(root, '[aria-current=page]')

const minimized = ref(false)
let lastY = 0
function onScroll() {
  const y = window.scrollY
  if (Math.abs(y - lastY) < 6) return
  minimized.value = y > lastY && y > 48
  lastY = y
}
onMounted(() => {
  if (!minimizeOnScroll) return
  lastY = window.scrollY
  window.addEventListener('scroll', onScroll, { passive: true })
})
onBeforeUnmount(() => window.removeEventListener('scroll', onScroll))
</script>

<template>
  <!-- A floating glass capsule. A softer lens slides under the current tab. -->
  <nav
    ref="root"
    :aria-label="label"
    data-slot="tab-bar"
    :data-minimized="minimized || undefined"
    :class="cn('relative isolate inline-flex rounded-full glass-regular p-1', className)"
  >
    <span
      aria-hidden="true"
      :style="lens"
      :class="[
        'absolute top-0 left-0 -z-1 rounded-full bg-fill-tertiary',
        'transition-[transform,width,height,scale] duration-(--duration-spring) ease-snappy',
        moving && 'scale-[1.08]',
      ]"
    />
    <component
      :is="item.href ? 'a' : 'button'"
      v-for="item in items"
      :key="item.value"
      :href="item.href"
      :type="item.href ? undefined : 'button'"
      :aria-current="item.value === active ? 'page' : undefined"
      :aria-label="minimized ? item.label : undefined"
      :class="
        cn(
          'flex cursor-pointer flex-col items-center justify-center rounded-full border-0 bg-transparent no-underline transition-[color,padding,scale] duration-(--duration-spring) ease-snappy active:scale-[0.94] active:duration-(--duration-fast)',
          minimized ? 'h-11 px-3.5' : 'h-[54px] min-w-[72px] gap-0.5 px-3',
          item.value === active ? 'text-tint' : 'text-label',
        )
      "
      @click="value = item.value"
    >
      <component :is="item.icon" :size="22" :stroke-width="2" aria-hidden="true" />
      <span
        :class="[
          'overflow-hidden text-caption-2 font-semibold transition-[opacity,max-height] duration-(--duration-normal) ease-out',
          minimized ? 'max-h-0 opacity-0' : 'max-h-4 opacity-100',
        ]"
      >
        {{ item.label }}
      </span>
    </component>
  </nav>
</template>
