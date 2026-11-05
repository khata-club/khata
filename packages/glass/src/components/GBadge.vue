<script setup lang="ts">
import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '../lib/cn'

const badgeVariants = cva(
  'inline-flex h-6 items-center gap-1.5 rounded-full px-2.5 text-footnote font-semibold whitespace-nowrap tabular-nums',
  {
    variants: {
      tone: {
        neutral: 'bg-fill-tertiary text-label-secondary',
        accent: 'bg-accent-soft text-tint',
        positive: 'bg-positive-soft text-positive',
        warning: 'bg-warning-soft text-warning',
        negative: 'bg-negative-soft text-negative',
      },
    },
    defaultVariants: { tone: 'neutral' },
  },
)

const {
  tone = 'neutral',
  dot = false,
  class: className,
} = defineProps<{
  tone?: VariantProps<typeof badgeVariants>['tone']
  /** Leading status dot in the badge colour. */
  dot?: boolean
  class?: string
}>()
</script>

<template>
  <span data-slot="badge" :class="cn(badgeVariants({ tone }), className)">
    <span v-if="dot" aria-hidden="true" class="size-1.5 rounded-full bg-current" />
    <slot />
  </span>
</template>
