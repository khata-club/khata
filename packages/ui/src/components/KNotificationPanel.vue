<script setup lang="ts">
import { Bell, X } from '@lucide/vue'
import { computed, nextTick, useId, useTemplateRef, type Component } from 'vue'

import { cn } from '../lib/cn'
import KCollapse from './KCollapse.vue'
import { softBadgeClasses, type Tone } from './tone'

export interface Notification {
  id: string
  icon: Component
  tone?: Tone
  title: string
  body?: string
  time?: string
  unread?: boolean
  /** Set false to dismiss (collapses out). */
  open?: boolean
}

export interface NotificationPanelLabels {
  markAllRead: string
  markAllUnread: string
  /** Screen-reader text for an unread item and the unread count. */
  unread: string
  dismiss: string
  empty: string
  restore: string
}

const DEFAULT_LABELS: NotificationPanelLabels = {
  markAllRead: 'Mark all read',
  markAllUnread: 'Mark all unread',
  unread: 'Unread',
  dismiss: 'Dismiss notification',
  empty: 'You’re all caught up',
  restore: 'Restore notifications',
}

const {
  title = 'Notifications',
  headingLevel = 2,
  labels: labelOverrides,
  class: className,
} = defineProps<{
  title?: string
  /** Heading level of the title (2 = <h2>). */
  headingLevel?: 2 | 3 | 4 | 5 | 6
  /** Override any of the English UI strings. */
  labels?: Partial<NotificationPanelLabels>
  class?: string
}>()

const items = defineModel<Notification[]>({ required: true })
defineEmits<{ restore: [] }>()

const labels = computed(() => ({ ...DEFAULT_LABELS, ...labelOverrides }))
const visible = computed(() => items.value.filter((n) => n.open !== false))
const unread = computed(() => visible.value.filter((n) => n.unread).length)

const titleId = useId()
const root = useTemplateRef<HTMLElement>('root')
const heading = useTemplateRef<HTMLElement>('heading')

function patch(id: string, changes: Partial<Notification>) {
  items.value = items.value.map((n) => (n.id === id ? { ...n, ...changes } : n))
}

/** Mark every visible notification read (or unread if all are read already). */
function toggleAll() {
  const markUnread = unread.value === 0
  items.value = items.value.map((n) => (n.open === false ? n : { ...n, unread: markUnread }))
}

/**
 * The focused dismiss button is about to be removed, which would drop focus to <body>. Move it to
 * the next notification (or the previous one, or the heading when the list empties).
 */
async function dismiss(id: string) {
  const i = visible.value.findIndex((n) => n.id === id)
  const next = visible.value[i + 1] ?? visible.value[i - 1]
  patch(id, { open: false })
  await nextTick()
  const target = next
    ? root.value?.querySelector<HTMLElement>(`[data-notification="${CSS.escape(next.id)}"]`)
    : heading.value
  target?.focus()
}
</script>

<template>
  <section
    ref="root"
    data-slot="notification-panel"
    :aria-labelledby="titleId"
    :class="cn('flex flex-col gap-6', className)"
  >
    <div class="flex items-center gap-3">
      <component
        :is="`h${headingLevel}`"
        :id="titleId"
        ref="heading"
        tabindex="-1"
        class="m-0 text-xl font-semibold outline-hidden"
      >
        {{ title }}
      </component>
      <!-- Visual count only; screen readers get the text below. -->
      <span
        aria-hidden="true"
        :class="
          cn(
            'grid h-6 min-w-6 place-items-center rounded-full bg-primary px-[7px] text-xs font-bold text-on-primary transition-[scale] duration-(--duration-slow) ease-standard',
            unread ? 'scale-100' : 'scale-0',
          )
        "
      >
        {{ unread }}
      </span>
      <span v-if="unread" class="sr-only">{{ unread }} {{ labels.unread.toLowerCase() }}</span>
      <button
        type="button"
        data-action="toggle-all"
        class="ml-auto min-h-9 cursor-pointer rounded-full border-0 bg-transparent px-4 text-sm font-semibold text-primary transition-colors duration-(--duration-normal) hover:bg-primary-subtle"
        @click="toggleAll"
      >
        {{ unread ? labels.markAllRead : labels.markAllUnread }}
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
              cn(
                'grid size-10 shrink-0 place-items-center rounded-full',
                softBadgeClasses[n.tone ?? 'primary'],
              )
            "
          >
            <component :is="n.icon" :size="20" aria-hidden="true" />
          </span>
          <button
            type="button"
            :data-notification="n.id"
            class="flex min-w-0 flex-1 cursor-pointer flex-col border-0 bg-transparent p-0 text-left text-fg"
            @click="patch(n.id, { unread: false })"
          >
            <span class="flex items-center gap-2">
              <span v-if="n.unread" class="sr-only">{{ labels.unread }}:</span>
              <span :class="cn('text-base', n.unread ? 'font-bold' : 'font-medium')">{{
                n.title
              }}</span>
              <span
                aria-hidden="true"
                :class="
                  cn(
                    'size-2 shrink-0 rounded-full bg-primary transition-[scale] duration-(--duration-slow) ease-standard',
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
            :aria-label="labels.dismiss"
            class="-mt-1 -mr-2 grid size-(--touch-target) shrink-0 cursor-pointer place-items-center rounded-full border-0 bg-transparent text-fg-muted hover:bg-surface-recessed"
            @click="dismiss(n.id)"
          >
            <X :size="18" aria-hidden="true" />
          </button>
        </div>
      </KCollapse>
      <KCollapse :open="visible.length === 0">
        <div class="flex flex-col items-center gap-2 border-t border-line py-8 text-center">
          <Bell :size="28" aria-hidden="true" class="text-line-control" />
          <span class="text-base font-semibold">{{ labels.empty }}</span>
          <button
            type="button"
            class="min-h-9 cursor-pointer rounded-full border-0 bg-transparent px-4 text-sm font-semibold text-primary hover:bg-primary-subtle"
            @click="$emit('restore')"
          >
            {{ labels.restore }}
          </button>
        </div>
      </KCollapse>
    </div>
  </section>
</template>
