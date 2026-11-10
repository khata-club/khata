<script setup lang="ts">
import { CircleAlert, CircleCheck, Info, TriangleAlert, X } from '@lucide/vue'
import { computed, type Component } from 'vue'

import { cn } from '../lib/cn'
import GCollapse from './GCollapse.vue'

type Tone = 'accent' | 'positive' | 'warning' | 'negative'

const {
  tone = 'accent',
  title,
  icon,
  dismissible = true,
  class: className,
} = defineProps<{
  tone?: Tone
  title: string
  /** Lucide icon component; each tone has a default. */
  icon?: Component
  dismissible?: boolean
  class?: string
}>()

/** Visible state. Dismissing collapses the alert away. */
const open = defineModel<boolean>('open', { default: true })

const TONES: Record<Tone, { icon: Component; color: string; role: 'status' | 'alert' }> = {
  accent: { icon: Info, color: 'bg-accent', role: 'status' },
  positive: { icon: CircleCheck, color: 'bg-green', role: 'status' },
  warning: { icon: TriangleAlert, color: 'bg-orange', role: 'alert' },
  negative: { icon: CircleAlert, color: 'bg-red', role: 'alert' },
}
const t = computed(() => TONES[tone])
</script>

<template>
  <GCollapse v-model:open="open">
    <div class="pb-2">
      <div
        :role="t.role"
        data-slot="alert"
        :class="
          cn('flex items-start gap-3 rounded-lg bg-surface py-3.5 pr-2 pl-4 shadow-card', className)
        "
      >
        <span
          :class="
            cn('mt-0.5 grid size-7 shrink-0 place-items-center rounded-full text-white', t.color)
          "
        >
          <component :is="icon ?? t.icon" :size="16" :stroke-width="2.5" aria-hidden="true" />
        </span>
        <span class="flex min-w-0 flex-1 flex-col gap-0.5 py-1">
          <span class="text-subhead font-semibold">{{ title }}</span>
          <span v-if="$slots.default" class="text-footnote text-label-secondary"><slot /></span>
        </span>
        <button
          v-if="dismissible"
          type="button"
          aria-label="Dismiss"
          class="grid size-9 shrink-0 cursor-pointer place-items-center rounded-full border-0 bg-transparent text-label-secondary transition-[background-color,scale] duration-(--duration-normal) hover:bg-fill-tertiary active:scale-90"
          @click="open = false"
        >
          <X :size="16" :stroke-width="2.5" aria-hidden="true" />
        </button>
      </div>
    </div>
  </GCollapse>
</template>
