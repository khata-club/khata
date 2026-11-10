<script setup lang="ts">
import { ChevronRight } from '@lucide/vue'
import { Primitive, type PrimitiveProps } from 'reka-ui'
import type { Component } from 'vue'

import { cn } from '../lib/cn'

interface Props extends PrimitiveProps {
  title: string
  subtitle?: string
  /** Leading icon, shown in a small rounded tile. */
  icon?: Component
  /** Tile colour for the icon, e.g. `var(--color-orange)`. */
  iconColor?: string
  /** Trailing value text (e.g. "On", "₹1,200"). */
  value?: string
  /** Disclosure chevron: the row navigates somewhere. */
  chevron?: boolean
  class?: string
}

const {
  as = 'div',
  asChild = false,
  title,
  subtitle,
  icon,
  iconColor = 'var(--color-accent)',
  value,
  chevron = false,
  class: className,
} = defineProps<Props>()
</script>

<template>
  <Primitive
    :as="as"
    :as-child="asChild"
    role="listitem"
    data-slot="list-row"
    :data-icon="icon ? '' : undefined"
    :class="
      cn(
        'flex min-h-11 w-full items-center gap-3 border-0 bg-transparent px-4 py-2 text-left text-body text-label no-underline',
        (as === 'a' || as === 'button') &&
          'cursor-pointer transition-colors duration-(--duration-fast) hover:bg-fill-quaternary active:bg-fill-tertiary',
        className,
      )
    "
  >
    <span
      v-if="icon"
      class="grid size-[30px] shrink-0 place-items-center rounded-[8px] text-white"
      :style="{ background: iconColor }"
    >
      <component :is="icon" :size="18" :stroke-width="2.25" aria-hidden="true" />
    </span>
    <slot name="leading" />
    <span class="flex min-w-0 flex-1 flex-col">
      <span class="truncate">{{ title }}</span>
      <span v-if="subtitle" class="truncate text-footnote text-label-secondary">{{
        subtitle
      }}</span>
    </span>
    <span v-if="value" class="shrink-0 text-body text-label-secondary tabular-nums">{{
      value
    }}</span>
    <slot name="trailing" />
    <ChevronRight
      v-if="chevron"
      :size="18"
      :stroke-width="2.5"
      aria-hidden="true"
      class="-mr-1 shrink-0 text-label-tertiary"
    />
  </Primitive>
</template>
