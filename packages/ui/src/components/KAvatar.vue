<script setup lang="ts">
import { cva, type VariantProps } from 'class-variance-authority'
import { AvatarFallback, AvatarImage, AvatarRoot } from 'reka-ui'

import { cn } from '../lib/cn'

const avatarVariants = cva(
  'relative inline-grid shrink-0 place-items-center rounded-full font-bold select-none',
  {
    variants: {
      size: {
        sm: 'size-8 text-xs [&_svg]:size-4',
        md: 'size-12 text-base [&_svg]:size-6',
        lg: 'size-[72px] text-xl [&_svg]:size-9',
      },
      tone: {
        subtle: 'bg-primary-subtle text-primary-pressed shadow-raised-sm',
        soft: 'bg-primary-soft text-primary-pressed shadow-raised-sm',
        primary: 'bg-primary text-on-primary shadow-primary-sm',
        muted: 'bg-surface-recessed text-fg-muted shadow-raised-sm',
      },
    },
    defaultVariants: { size: 'md', tone: 'subtle' },
  },
)

const {
  src,
  alt = '',
  size = 'md',
  tone = 'subtle',
  online = false,
  onlineLabel = 'Online',
  class: className,
} = defineProps<{
  src?: string
  alt?: string
  size?: VariantProps<typeof avatarVariants>['size']
  tone?: VariantProps<typeof avatarVariants>['tone']
  /** Pulsing green presence dot, announced as `onlineLabel`. */
  online?: boolean
  onlineLabel?: string
  class?: string
}>()
</script>

<template>
  <AvatarRoot data-slot="avatar" :class="cn(avatarVariants({ size, tone }), className)">
    <AvatarImage v-if="src" :src="src" :alt="alt" class="size-full rounded-full object-cover" />
    <AvatarFallback class="col-start-1 row-start-1 grid place-items-center">
      <slot />
    </AvatarFallback>
    <span
      v-if="online"
      role="img"
      :aria-label="onlineLabel"
      class="absolute top-[3px] right-[3px] block size-4 animate-ck-pulse rounded-full border-[2.5px] border-surface bg-success"
    />
  </AvatarRoot>
</template>
