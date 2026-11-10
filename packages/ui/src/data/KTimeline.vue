<script setup lang="ts">
import { cn } from '../lib/cn'
import type { StatusTone } from './KStatusPill.vue'

export interface TimelineItem {
  id: string
  title: string
  /** ISO timestamp or preformatted time. */
  time?: string
  description?: string
  tone?: StatusTone
  /** Optional duration since the previous stage, e.g. `42 ms`. */
  duration?: string
}

const {
  items,
  label,
  class: className,
} = defineProps<{
  items: TimelineItem[]
  label: string
  class?: string
}>()

const dots: Record<StatusTone, string> = {
  neutral: 'bg-fg-muted',
  primary: 'bg-primary',
  success: 'bg-success',
  warning: 'bg-warning',
  danger: 'bg-danger',
}
</script>

<template>
  <ol data-slot="timeline" :aria-label="label" :class="cn('m-0 list-none p-0', className)">
    <li v-for="(item, i) in items" :key="item.id" class="relative flex gap-4 pb-5 last:pb-0">
      <span
        v-if="i < items.length - 1"
        class="absolute top-4 bottom-0 left-[5px] w-px bg-line"
        aria-hidden="true"
      />
      <span
        :class="
          cn(
            'relative mt-1.5 size-[11px] shrink-0 rounded-full ring-4 ring-surface',
            dots[item.tone ?? 'neutral'],
          )
        "
        aria-hidden="true"
      />
      <div class="flex min-w-0 flex-1 flex-col gap-0.5">
        <div class="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
          <span class="text-sm font-semibold">{{ item.title }}</span>
          <time v-if="item.time" :datetime="item.time" class="font-mono text-xs text-fg-muted">
            {{ item.time }}
          </time>
          <span v-if="item.duration" class="text-xs text-fg-muted">+{{ item.duration }}</span>
        </div>
        <p v-if="item.description" class="m-0 text-sm text-fg-muted">{{ item.description }}</p>
        <slot :name="`item-${item.id}`" :item="item" />
      </div>
    </li>
  </ol>
</template>
