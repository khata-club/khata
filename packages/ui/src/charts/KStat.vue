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

type DeltaTone = 'good' | 'bad' | 'muted'
const DELTA_PILL: Record<DeltaTone, string> = {
  good: 'bg-success-subtle text-success',
  bad: 'bg-danger-subtle text-danger',
  muted: 'bg-surface-recessed text-fg-muted',
}
const DELTA_TEXT: Record<DeltaTone, string> = {
  good: 'text-success',
  bad: 'text-danger',
  muted: 'text-fg-muted',
}
</script>

<template>
  <!-- Not a live region: hover read-outs change on every pointer move and would flood a screen
       reader. Each chart's accessible name summarises the data instead. -->
  <div :class="cn('flex flex-col', size === 'lg' ? 'gap-1' : 'gap-0.5', className)">
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
            DELTA_PILL[deltaTone ?? 'good'],
          )
        "
      >
        {{ delta }}
      </span>
      <span v-else-if="delta" :class="cn('font-mono text-xs', DELTA_TEXT[deltaTone ?? 'muted'])">
        {{ delta }}
      </span>
    </div>
  </div>
</template>
