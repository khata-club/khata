<script setup lang="ts">
import { Menu } from '@lucide/vue'

import { cn } from '../lib/cn'

const {
  title,
  menuLabel = 'Open navigation',
  class: className,
} = defineProps<{
  title?: string
  menuLabel?: string
  class?: string
}>()

const emit = defineEmits<{ menu: [] }>()
</script>

<template>
  <header
    data-slot="topbar"
    :class="
      cn(
        'sticky top-0 z-10 flex min-h-16 items-center gap-3 border-b border-line bg-white/86 px-4 backdrop-blur-[10px] sm:px-6',
        className,
      )
    "
  >
    <button
      type="button"
      :aria-label="menuLabel"
      class="grid size-10 cursor-pointer place-items-center rounded-md border-0 bg-transparent text-fg-muted hover:bg-surface-recessed hover:text-fg md:hidden"
      @click="emit('menu')"
    >
      <Menu :size="22" aria-hidden="true" />
    </button>
    <div class="flex min-w-0 flex-1 flex-col justify-center gap-0.5 py-2">
      <slot name="breadcrumbs" />
      <h1 v-if="title" class="truncate text-lg font-bold">{{ title }}</h1>
    </div>
    <div v-if="$slots.actions" class="flex shrink-0 items-center gap-2">
      <slot name="actions" />
    </div>
  </header>
</template>
