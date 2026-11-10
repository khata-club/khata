<script setup lang="ts">
import { computed, type Component } from 'vue'

import { cn } from '../lib/cn'

export interface BottomNavItem {
  value: string
  label: string
  icon: Component
  href?: string
}

const {
  items,
  label = 'Primary',
  class: className,
} = defineProps<{
  items: BottomNavItem[]
  label?: string
  class?: string
}>()

const value = defineModel<string>()
/** Unset model → first item; a value that matches no item → -1 (nothing marked current). */
const activeIndex = computed(() =>
  items.findIndex((item) => item.value === (value.value ?? items[0]?.value)),
)
</script>

<template>
  <nav
    :aria-label="label"
    data-slot="bottom-nav"
    :class="
      cn(
        'relative grid w-full rounded-2xl border border-line bg-surface px-2 pt-2 pb-4 shadow-raised',
        className,
      )
    "
    :style="{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }"
  >
    <component
      :is="item.href ? 'a' : 'button'"
      v-for="(item, i) in items"
      :key="item.value"
      :href="item.href"
      :type="item.href ? undefined : 'button'"
      :aria-current="i === activeIndex ? (item.href ? 'page' : 'true') : undefined"
      :class="
        cn(
          'flex min-h-16 cursor-pointer flex-col items-center justify-center gap-1.5 rounded-lg border-0 bg-transparent text-sm no-underline transition-colors duration-(--duration-normal) ease-standard hover:text-primary',
          i === activeIndex ? 'font-semibold text-primary' : 'font-medium text-fg-muted',
        )
      "
      @click="value = item.value"
    >
      <component
        :is="item.icon"
        :size="26"
        aria-hidden="true"
        :class="
          cn(
            'transition-transform duration-(--duration-slow) ease-standard',
            i === activeIndex && '-translate-y-0.5',
          )
        "
      />
      {{ item.label }}
    </component>
    <!-- Dot glides under the active item: centre of column i, inside the px-2 (8px) padding,
         offset by half the dot (3px). -->
    <span
      v-if="activeIndex >= 0"
      aria-hidden="true"
      class="absolute bottom-2.5 size-1.5 rounded-full bg-primary transition-[left] duration-(--duration-slow) ease-standard"
      :style="{
        left: `calc(8px + (100% - 16px) * ${(activeIndex * 2 + 1) / (items.length * 2)} - 3px)`,
      }"
    />
  </nav>
</template>
