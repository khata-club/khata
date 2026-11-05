<script setup lang="ts">
import type { Component } from 'vue'

import { cn } from '../lib/cn'

const {
  title,
  description,
  icon,
  class: className,
} = defineProps<{
  title: string
  description?: string
  icon?: Component
  class?: string
}>()
</script>

<template>
  <div
    data-slot="empty-state"
    :class="cn('flex flex-col items-center gap-3 px-6 py-12 text-center', className)"
  >
    <span
      v-if="icon"
      class="grid size-12 place-items-center rounded-full bg-primary-subtle text-primary"
      aria-hidden="true"
    >
      <component :is="icon" :size="24" />
    </span>
    <p class="text-base font-semibold">{{ title }}</p>
    <p v-if="description" class="max-w-sm text-sm text-fg-muted">{{ description }}</p>
    <div v-if="$slots.default" class="mt-1 flex flex-wrap justify-center gap-2"><slot /></div>
  </div>
</template>
