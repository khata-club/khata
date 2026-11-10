<script setup lang="ts">
import type { Component } from 'vue'

import { cn } from '../lib/cn'

const {
  icon,
  size = 20,
  label,
  class: className,
} = defineProps<{
  /** A Lucide icon component, e.g. `import { House } from '@lucide/vue'`. */
  icon: Component
  /** 16, 20 or 24 on the type scale; any number works (`& {}` keeps the literals as hints). */
  size?: 16 | 20 | 24 | (number & {})
  /** Accessible name. Without one the icon is decorative (`aria-hidden`). */
  label?: string
  class?: string
}>()
</script>

<template>
  <component
    :is="icon"
    :size="size"
    :stroke-width="2"
    :aria-hidden="label ? undefined : true"
    :aria-label="label"
    :role="label ? 'img' : undefined"
    data-slot="icon"
    :class="cn('shrink-0', className)"
  />
</template>
