<script setup lang="ts">
import { Check, CircleAlert, ShieldCheck, TriangleAlert, X } from '@lucide/vue'
import { computed, useTemplateRef, type Component } from 'vue'

import { cn } from '../lib/cn'
import { focusNearestOutside } from '../lib/focus'
import KCollapse from './KCollapse.vue'
import type { Tone } from './tone'

const {
  tone = 'primary',
  title,
  icon,
  dismissible = true,
  dismissLabel = 'Dismiss',
  class: className,
} = defineProps<{
  tone?: Tone
  title: string
  /** Lucide icon component; each tone has a default. */
  icon?: Component
  dismissible?: boolean
  /** Accessible name of the dismiss button. */
  dismissLabel?: string
  class?: string
}>()

const open = defineModel<boolean>('open', { default: true })

const toneClasses: Record<
  Tone,
  { box: string; badge: string; icon: Component; role: 'status' | 'alert' }
> = {
  primary: {
    box: 'border-primary-soft bg-primary-subtle',
    badge: 'bg-primary',
    icon: Check,
    role: 'status',
  },
  success: {
    box: 'border-success-border bg-success-subtle',
    badge: 'bg-success',
    icon: ShieldCheck,
    role: 'status',
  },
  warning: {
    box: 'border-warning-border bg-warning-subtle',
    badge: 'bg-warning',
    icon: TriangleAlert,
    role: 'alert',
  },
  danger: {
    box: 'border-danger-border bg-danger-subtle',
    badge: 'bg-danger',
    icon: CircleAlert,
    role: 'alert',
  },
}
const style = computed(() => toneClasses[tone])

const box = useTemplateRef<HTMLElement>('box')

function dismiss() {
  // The dismiss button holds focus and is about to unmount: hand focus to a neighbour first.
  if (box.value?.contains(document.activeElement)) focusNearestOutside(box.value)
  open.value = false
}
</script>

<template>
  <KCollapse v-model:open="open">
    <div class="px-1.5 pt-1 pb-2.5">
      <div
        ref="box"
        :role="style.role"
        data-slot="alert"
        :class="
          cn(
            'flex items-center gap-4 rounded-lg border py-4 pr-4 pl-5 shadow-raised-sm',
            style.box,
            className,
          )
        "
      >
        <span
          :class="
            cn(
              'grid size-11 shrink-0 place-items-center rounded-full text-on-primary shadow-primary-sm',
              style.badge,
            )
          "
        >
          <component :is="icon ?? style.icon" :size="22" aria-hidden="true" />
        </span>
        <span class="flex min-w-0 flex-1 flex-col">
          <span class="text-lg font-bold">{{ title }}</span>
          <span v-if="$slots.default" class="text-sm text-fg-muted"><slot /></span>
        </span>
        <button
          v-if="dismissible"
          type="button"
          :aria-label="dismissLabel"
          class="grid size-(--touch-target) shrink-0 cursor-pointer place-items-center rounded-full border-0 bg-transparent text-fg-muted transition-[background-color,rotate] duration-(--duration-normal) ease-standard hover:rotate-90 hover:bg-surface/80"
          @click="dismiss"
        >
          <X :size="20" aria-hidden="true" />
        </button>
      </div>
    </div>
  </KCollapse>
</template>
