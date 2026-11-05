<script setup lang="ts">
import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '../lib/cn'

const badgeVariants = cva(
  'inline-flex h-[26px] items-center gap-1.5 rounded-md border px-2.5 text-xs font-semibold whitespace-nowrap',
  {
    variants: {
      tone: {
        neutral: 'border-line bg-surface-recessed text-fg-muted',
        primary: 'border-primary-soft bg-primary-subtle text-primary-pressed',
        success: 'border-success-border bg-success-subtle text-success',
        warning: 'border-warning-border bg-warning-subtle text-warning',
        danger: 'border-danger-border bg-danger-subtle text-danger',
      },
    },
    defaultVariants: { tone: 'neutral' },
  },
)

const {
  tone = 'neutral',
  dot = true,
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
