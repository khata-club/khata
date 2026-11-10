<script setup lang="ts">
import { BellOff, X } from '@lucide/vue'
import { computed, type Component } from 'vue'

import { cn } from '../lib/cn'
import GCollapse from './GCollapse.vue'

export interface Notification {
  id: string
  icon: Component
  tone?: 'accent' | 'positive' | 'warning' | 'negative'
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
  accent: 'bg-accent',
  positive: 'bg-green',
  warning: 'bg-orange',
  negative: 'bg-red',
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
  <!-- Notifications as a stack of glass platters, like Notification Centre. -->
  <section
    data-slot="notification-panel"
    :aria-label="title"
    :class="cn('flex flex-col gap-3', className)"
  >
    <div class="flex items-center gap-2 px-1">
      <span class="text-title-3 font-semibold">{{ title }}</span>
      <span
        :aria-label="`${unread} unread`"
        :class="
          cn(
            'grid h-5 min-w-5 place-items-center rounded-full bg-red px-1.5 text-caption font-semibold text-white tabular-nums transition-[scale] duration-(--duration-spring) ease-bouncy',
            unread ? 'scale-100' : 'scale-0',
          )
        "
      >
        {{ unread }}
      </span>
      <button
        type="button"
        class="ml-auto h-8 cursor-pointer rounded-full border-0 bg-transparent px-3 text-subhead font-medium text-tint transition-colors duration-(--duration-fast) hover:bg-fill-quaternary"
        @click="toggleAll"
      >
        {{ unread ? 'Mark all read' : 'Mark all unread' }}
      </button>
    </div>
    <div class="flex flex-col">
      <GCollapse
        v-for="n in items"
        :key="n.id"
        :open="n.open !== false"
        @update:open="patch(n.id, { open: $event })"
      >
        <div class="pb-2">
          <div class="group relative flex items-start gap-3 rounded-[24px] glass-regular p-3.5">
            <span
              :class="
                cn(
                  'grid size-9 shrink-0 place-items-center rounded-[10px] text-white',
                  TONE[n.tone ?? 'accent'],
                )
              "
            >
              <component :is="n.icon" :size="18" :stroke-width="2.25" aria-hidden="true" />
            </span>
            <button
              type="button"
              class="flex min-w-0 flex-1 cursor-pointer flex-col border-0 bg-transparent p-0 text-left text-label"
              @click="patch(n.id, { unread: false })"
            >
              <span class="flex items-baseline gap-2">
                <span class="truncate text-subhead font-semibold">{{ n.title }}</span>
                <span
                  :aria-label="n.unread ? 'Unread' : undefined"
                  :aria-hidden="n.unread ? undefined : true"
                  :class="
                    cn(
                      'size-2 shrink-0 self-center rounded-full bg-accent transition-[scale] duration-(--duration-spring) ease-bouncy',
                      n.unread ? 'scale-100' : 'scale-0',
                    )
                  "
                />
                <span
                  v-if="n.time"
                  class="ml-auto shrink-0 text-footnote text-label-secondary tabular-nums"
                  >{{ n.time }}</span
                >
              </span>
              <span v-if="n.body" class="text-subhead [text-wrap:pretty] text-label">{{
                n.body
              }}</span>
            </button>
            <button
              type="button"
              aria-label="Dismiss notification"
              class="absolute -top-1.5 -left-1.5 grid size-6 cursor-pointer place-items-center rounded-full border-0 glass-thick text-label-secondary opacity-0 transition-[opacity,scale] duration-(--duration-normal) group-hover:opacity-100 focus-visible:opacity-100 active:scale-90 [@media(hover:none)]:opacity-100"
              @click="patch(n.id, { open: false })"
            >
              <X :size="12" :stroke-width="3" aria-hidden="true" />
            </button>
          </div>
        </div>
      </GCollapse>
      <GCollapse :open="visible.length === 0">
        <div class="flex flex-col items-center gap-2 py-8 text-center">
          <BellOff :size="28" aria-hidden="true" class="text-label-tertiary" />
          <span class="text-body font-semibold">No notifications</span>
          <button
            type="button"
            class="h-8 cursor-pointer rounded-full border-0 bg-transparent px-3 text-subhead font-medium text-tint hover:bg-fill-quaternary"
            @click="$emit('restore')"
          >
            Restore notifications
          </button>
        </div>
      </GCollapse>
    </div>
  </section>
</template>
