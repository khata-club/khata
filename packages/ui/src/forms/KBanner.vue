<script setup lang="ts">
import { CircleCheck, Info, Lock, TriangleAlert } from '@lucide/vue'
import { computed, type Component } from 'vue'

import { cn } from '../lib/cn'

type Tone = 'success' | 'neutral' | 'warning' | 'primary'

const {
  tone = 'neutral',
  title,
  icon,
  class: className,
} = defineProps<{
  tone?: Tone
  title: string
  icon?: Component
  class?: string
}>()

const toneClasses: Record<
  Tone,
  { box: string; iconColor: string; icon: Component; role: 'status' | 'alert' }
> = {
  success: {
    box: 'border-success-border bg-success-subtle',
    iconColor: 'text-success',
    icon: CircleCheck,
    role: 'status',
  },
  neutral: {
    box: 'border-line bg-surface-subtle',
    iconColor: 'text-fg-muted',
    icon: Lock,
    role: 'status',
  },
  // Warnings interrupt, matching KAlert.
  warning: {
    box: 'border-warning-border bg-warning-subtle',
    iconColor: 'text-warning',
    icon: TriangleAlert,
    role: 'alert',
  },
  primary: {
    box: 'border-primary-soft bg-primary-subtle',
    iconColor: 'text-primary',
    icon: Info,
    role: 'status',
  },
}
const style = computed(() => toneClasses[tone])
</script>

<template>
  <div
    :role="style.role"
    data-slot="banner"
    :class="
      cn(
        'flex animate-ck-rise items-center gap-4 rounded-lg border px-6 py-5',
        style.box,
        className,
      )
    "
  >
    <component
      :is="icon ?? style.icon"
      :size="24"
      aria-hidden="true"
      :class="cn('shrink-0', style.iconColor)"
    />
    <div class="flex min-w-0 flex-1 flex-col">
      <span class="text-base font-bold">{{ title }}</span>
      <span v-if="$slots.default" class="text-sm text-fg-muted"><slot /></span>
    </div>
    <slot name="action" />
  </div>
</template>
