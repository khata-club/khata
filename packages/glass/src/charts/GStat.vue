<script setup lang="ts">
import { cn } from '../lib/cn'

const {
  label,
  value,
  delta,
  deltaTone,
  size = 'md',
  valueClass,
  class: className,
} = defineProps<{
  label: string
  value: string
  delta?: string
  /** `good` / `bad` colour the delta; `muted` greys it. */
  deltaTone?: 'good' | 'bad' | 'muted'
  /** `lg` = hero number. */
  size?: 'md' | 'lg' | 'sm'
  valueClass?: string
  class?: string
}>()
</script>

<template>
  <!-- aria-live so hover read-outs (selected month, price…) are announced. -->
  <div :class="cn('flex flex-col', className)" aria-live="polite">
    <span class="text-footnote text-label-secondary">{{ label }}</span>
    <span
      :class="
        cn(
          'font-semibold tabular-nums',
          size === 'lg'
            ? 'text-large-title font-bold'
            : size === 'sm'
              ? 'text-body'
              : 'text-title-2',
          valueClass,
        )
      "
    >
      {{ value }}
    </span>
    <span
      v-if="delta"
      :class="
        cn(
          'text-footnote font-medium tabular-nums',
          deltaTone === 'bad'
            ? 'text-negative'
            : deltaTone === 'good'
              ? 'text-positive'
              : 'text-label-secondary',
        )
      "
    >
      {{ delta }}
    </span>
  </div>
</template>
