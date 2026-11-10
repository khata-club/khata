<script setup lang="ts">
import { DialogContent, DialogOverlay, DialogPortal, DialogRoot, DialogTitle } from 'reka-ui'

import { cn } from '../lib/cn'

const { label = 'Navigation', class: className } = defineProps<{
  /** Accessible name for the mobile navigation drawer. */
  label?: string
  class?: string
}>()

/** Mobile drawer state. On wide screens the sidebar is always visible. */
const sidebarOpen = defineModel<boolean>('sidebarOpen', { default: false })
</script>

<template>
  <div
    data-slot="app-shell"
    :class="cn('grid min-h-screen bg-canvas font-sans text-fg md:grid-cols-[264px_1fr]', className)"
  >
    <aside class="sticky top-0 h-screen border-r border-line bg-surface max-md:hidden">
      <slot name="sidebar" />
    </aside>

    <DialogRoot v-model:open="sidebarOpen">
      <DialogPortal>
        <DialogOverlay class="fixed inset-0 z-40 bg-fg/30 backdrop-blur-[2px] md:hidden" />
        <DialogContent
          class="fixed inset-y-0 left-0 z-50 w-[min(300px,85vw)] border-r border-line bg-surface shadow-floating outline-none md:hidden"
        >
          <DialogTitle class="sr-only">{{ label }}</DialogTitle>
          <slot name="sidebar" />
        </DialogContent>
      </DialogPortal>
    </DialogRoot>

    <div class="flex min-w-0 flex-col">
      <slot name="topbar" />
      <main class="mx-auto w-full max-w-[1180px] flex-1 px-4 py-6 sm:px-6 sm:py-8">
        <slot />
      </main>
    </div>
  </div>
</template>
