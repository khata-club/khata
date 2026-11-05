<script setup lang="ts">
import { Primitive, type PrimitiveProps } from 'reka-ui'
import type { Component } from 'vue'

import { cn } from '../lib/cn'

interface Props extends PrimitiveProps {
  icon?: Component
  /** Marks the item as the current page (`aria-current="page"`). */
  current?: boolean
  /** Count shown in a pill, e.g. unread items. */
  badge?: string | number
  class?: string
}

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
        'flex min-h-(--touch-target) w-full cursor-pointer items-center gap-3 rounded-md border-0 px-3 text-left text-base transition-[background-color,color] duration-(--duration-normal) ease-standard hover:text-primary',
        current
          ? 'bg-primary-subtle font-semibold text-primary-pressed'
          : 'bg-transparent font-medium text-fg-muted',
        className,
      )
    "
  >
    <component :is="icon" v-if="icon" :size="20" aria-hidden="true" class="shrink-0" />
    <span class="flex-1"><slot /></span>
    <span
      v-if="badge != null"
      class="grid h-[22px] min-w-[22px] place-items-center rounded-full bg-primary px-1.5 text-xs font-bold text-on-primary"
    >
      {{ badge }}
    </span>
    <span
      aria-hidden="true"
      :class="
        cn(
          'size-1.5 shrink-0 rounded-full bg-primary transition-transform duration-(--duration-slow) ease-standard',
          current ? 'scale-100' : 'scale-0',
        )
      "
    />
  </Primitive>
</template>
