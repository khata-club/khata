<script setup lang="ts">
import { Primitive, type PrimitiveProps } from 'reka-ui'
import type { Component } from 'vue'

import { cn } from '../lib/cn'

interface Props extends PrimitiveProps {
  icon?: Component
  /** Marks the item as the current page (`aria-current="page"`). */
  current?: boolean
  /** Count shown at the trailing edge, e.g. unread items. */
  badge?: string | number
  class?: string
}

// Sidebar row: the current page sits on a soft fill with an accent icon.
const {
  as = 'button',
  asChild = false,
  icon,
  current = false,
  badge,
  class: className,
} = defineProps<Props>()
</script>

<template>
  <Primitive
    :as="as"
    :as-child="asChild"
    :type="as === 'button' ? 'button' : undefined"
    :aria-current="current ? 'page' : undefined"
    data-slot="nav-item"
    :class="
      cn(
        'flex min-h-10 w-full cursor-pointer items-center gap-3 rounded-[12px] border-0 px-3 text-left text-body text-label no-underline',
        'transition-[background-color,scale] duration-(--duration-normal) ease-out active:scale-[0.98]',
        current ? 'bg-fill-tertiary font-semibold' : 'bg-transparent hover:bg-fill-quaternary',
        className,
      )
    "
  >
    <component
      :is="icon"
      v-if="icon"
      :size="20"
      aria-hidden="true"
      :class="cn('shrink-0', current ? 'text-tint' : 'text-label-secondary')"
    />
    <span class="flex-1 truncate"><slot /></span>
    <span v-if="badge != null" class="text-subhead text-label-secondary tabular-nums">
      {{ badge }}
    </span>
  </Primitive>
</template>
