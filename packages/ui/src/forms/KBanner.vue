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

const TONES: Record<Tone, { box: string; icon: string; def: Component }> = {
  success: {
    box: 'border-success-border bg-success-subtle',
    icon: 'text-success',
    def: CircleCheck,
  },
  neutral: { box: 'border-line bg-surface-subtle', icon: 'text-fg-muted', def: Lock },
  warning: {
    box: 'border-warning-border bg-warning-subtle',
    icon: 'text-warning',
    def: TriangleAlert,
  },
  primary: { box: 'border-primary-soft bg-primary-subtle', icon: 'text-primary', def: Info },
}
const t = computed(() => TONES[tone])
</script>

<template>
  <div
    role="status"
    data-slot="banner"
    :class="
      cn('flex animate-ck-rise items-center gap-4 rounded-lg border px-6 py-5', t.box, className)
    "
  >
    <component :is="icon ?? t.def" :size="24" aria-hidden="true" :class="cn('shrink-0', t.icon)" />
    <div class="flex min-w-0 flex-1 flex-col">
      <span class="text-base font-bold">{{ title }}</span>
      <span v-if="$slots.default" class="text-sm text-fg-muted"><slot /></span>
    </div>
    <slot name="action" />
  </div>
</template>
