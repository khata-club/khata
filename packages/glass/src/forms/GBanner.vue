<script setup lang="ts">
import { CircleCheck, Info, Lock, TriangleAlert } from '@lucide/vue'
import { computed, type Component } from 'vue'

import { cn } from '../lib/cn'

type Tone = 'positive' | 'neutral' | 'warning' | 'accent'

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
  positive: { box: 'bg-positive-soft', icon: 'text-positive', def: CircleCheck },
  neutral: { box: 'bg-fill-quaternary', icon: 'text-label-secondary', def: Lock },
  warning: { box: 'bg-warning-soft', icon: 'text-warning', def: TriangleAlert },
  accent: { box: 'bg-accent-soft', icon: 'text-tint', def: Info },
}
const t = computed(() => TONES[tone])
</script>

<template>
  <div
    role="status"
    data-slot="banner"
    :class="cn('flex animate-g-rise items-center gap-3 rounded-lg px-4 py-3.5', t.box, className)"
  >
    <component :is="icon ?? t.def" :size="20" aria-hidden="true" :class="cn('shrink-0', t.icon)" />
    <div class="flex min-w-0 flex-1 flex-col">
      <span class="text-subhead font-semibold">{{ title }}</span>
      <span v-if="$slots.default" class="text-footnote text-label-secondary"><slot /></span>
    </div>
    <slot name="action" />
  </div>
</template>
