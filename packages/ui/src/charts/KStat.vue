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
  /** `lg` = display size (hero numbers). */
  size?: 'md' | 'lg' | 'sm'
  valueClass?: string
  class?: string
}>()
</script>

<template>
  <!-- aria-live so hover read-outs (selected month, price…) are announced. -->
  <div
    :class="cn('flex flex-col', size === 'lg' ? 'gap-1' : 'gap-0.5', className)"
    aria-live="polite"
  >
    <span class="text-xs font-semibold tracking-label text-fg-muted uppercase">{{ label }}</span>
    <div class="flex flex-wrap items-baseline gap-3" :class="size === 'lg' && 'items-center'">
      <span
        :class="
          cn(
            'font-semibold tabular-nums',
            size === 'lg' ? 'text-display' : size === 'sm' ? 'font-mono text-lg' : 'text-2xl',
            valueClass,
          )
        "
      >
        {{ value }}
      </span>
      <span
        v-if="delta && size === 'lg'"
        :class="
          cn(
            'inline-flex h-7 items-center rounded-full px-3 font-mono text-xs',
            deltaTone === 'bad' ? 'bg-danger-subtle text-danger' : 'bg-success-subtle text-success',
          )
        "
      >
        {{ delta }}
      </span>
      <span
        v-else-if="delta"
        :class="
          cn(
            'font-mono text-xs',
            deltaTone === 'bad'
              ? 'text-danger'
              : deltaTone === 'good'
                ? 'text-success'
                : 'text-fg-muted',
          )
        "
      >
        {{ delta }}
      </span>
    </div>
  </div>
</template>
