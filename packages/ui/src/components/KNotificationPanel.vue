<script setup lang="ts">
import { Bell, X } from '@lucide/vue'
import { computed, type Component } from 'vue'

import { cn } from '../lib/cn'
import KCollapse from './KCollapse.vue'

export interface Notification {
  id: string
  icon: Component
  tone?: 'primary' | 'success' | 'warning' | 'danger'
  title: string
  body?: string
  time?: string
  unread?: boolean
  /** Set false to dismiss (collapses out). */
  open?: boolean
}

const { title = 'Notifications', class: className } = defineProps<{
  title?: string
  class?: string
}>()

const items = defineModel<Notification[]>({ required: true })
defineEmits<{ restore: [] }>()

const visible = computed(() => items.value.filter((n) => n.open !== false))
const unread = computed(() => visible.value.filter((n) => n.unread).length)

const TONE = {
  primary: 'bg-primary-subtle text-primary',
  success: 'bg-success-subtle text-success',
  warning: 'bg-warning-subtle text-warning',
  danger: 'bg-danger-subtle text-danger',
} as const

function patch(id: string, p: Partial<Notification>) {
  items.value = items.value.map((n) => (n.id === id ? { ...n, ...p } : n))
}
function toggleAll() {
  const next = unread.value === 0
  items.value = items.value.map((n) => ({ ...n, unread: next }))
}
</script>

<template>
  <section
    data-slot="notification-panel"
    :aria-label="title"
    :class="cn('flex flex-col gap-6', className)"
  >
    <div class="flex items-center gap-3">
      <span class="text-xl font-semibold">{{ title }}</span>
      <span
        :aria-label="`${unread} unread`"
        :class="
          cn(
            'grid h-6 min-w-6 place-items-center rounded-full bg-primary px-[7px] text-xs font-bold text-on-primary transition-transform duration-(--duration-slow) ease-standard',
            unread ? 'scale-100' : 'scale-0',
          )
        "
      >
        {{ unread }}
      </span>
      <button
        type="button"
        class="ml-auto h-9 cursor-pointer rounded-full border-0 bg-transparent px-4 text-sm font-semibold text-primary transition-colors duration-(--duration-normal) hover:bg-primary-subtle"
        @click="toggleAll"
      >
        {{ unread ? 'Mark all read' : 'Mark all unread' }}
      </button>
    </div>
    <div class="flex flex-col">
      <KCollapse
        v-for="n in items"
        :key="n.id"
        :open="n.open !== false"
        @update:open="patch(n.id, { open: $event })"
      >
        <div class="flex items-start gap-3 border-t border-line py-3">
          <span
            :class="
              cn('grid size-10 shrink-0 place-items-center rounded-full', TONE[n.tone ?? 'primary'])
            "
          >
            <component :is="n.icon" :size="20" aria-hidden="true" />
          </span>
          <button
            type="button"
            class="flex min-w-0 flex-1 cursor-pointer flex-col border-0 bg-transparent p-0 text-left text-fg"
            @click="patch(n.id, { unread: false })"
          >
            <span class="flex items-center gap-2">
              <span :class="cn('text-base', n.unread ? 'font-bold' : 'font-medium')">{{
                n.title
              }}</span>
              <span
                :aria-label="n.unread ? 'Unread' : undefined"
                :aria-hidden="n.unread ? undefined : true"
                :class="
                  cn(
                    'size-2 shrink-0 rounded-full bg-primary transition-transform duration-(--duration-slow) ease-standard',
                    n.unread ? 'scale-100' : 'scale-0',
                  )
                "
              />
            </span>
            <span v-if="n.body" class="text-sm text-fg-muted">{{ n.body }}</span>
            <span v-if="n.time" class="mt-0.5 font-mono text-xs text-fg-muted">{{ n.time }}</span>
          </button>
          <button
            type="button"
            aria-label="Dismiss notification"
            class="-mt-1 -mr-2 grid size-(--touch-target) shrink-0 cursor-pointer place-items-center rounded-full border-0 bg-transparent text-fg-muted hover:bg-surface-recessed"
            @click="patch(n.id, { open: false })"
          >
            <X :size="18" aria-hidden="true" />
          </button>
        </div>
      </KCollapse>
      <KCollapse :open="visible.length === 0">
        <div class="flex flex-col items-center gap-2 border-t border-line py-8 text-center">
          <Bell :size="28" aria-hidden="true" class="text-gray-400" />
          <span class="text-base font-semibold">You’re all caught up</span>
          <button
            type="button"
            class="h-9 cursor-pointer rounded-full border-0 bg-transparent px-4 text-sm font-semibold text-primary hover:bg-primary-subtle"
            @click="$emit('restore')"
          >
            Restore notifications
          </button>
        </div>
      </KCollapse>
    </div>
  </section>
</template>
