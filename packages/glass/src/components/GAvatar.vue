<script setup lang="ts">
import { cva, type VariantProps } from 'class-variance-authority'
import { AvatarFallback, AvatarImage, AvatarRoot } from 'reka-ui'

import { cn } from '../lib/cn'

// Monograms sit on a soft vertical gradient, like Contacts.
const avatarVariants = cva(
  'relative inline-grid shrink-0 place-items-center rounded-full font-semibold text-white select-none',
  {
    variants: {
      size: {
        sm: 'size-8 text-footnote [&_svg]:size-4',
        md: 'size-11 text-body [&_svg]:size-5',
        lg: 'size-[72px] text-title-2 [&_svg]:size-8',
      },
      tone: {
        gray: 'bg-linear-to-b from-[#a8adba] to-[#858a96]',
        accent: 'bg-linear-to-b from-[#4aa3ff] to-[#0062d1]',
        teal: 'bg-linear-to-b from-[#5fd3e6] to-[#1d8fa5]',
        orange: 'bg-linear-to-b from-[#ffb340] to-[#e07800]',
        purple: 'bg-linear-to-b from-[#d189f5] to-[#9440c7]',
      },
    },
    defaultVariants: { size: 'md', tone: 'gray' },
  },
)

const {
  src,
  alt = '',
  size = 'md',
  tone = 'gray',
  online = false,
  class: className,
} = defineProps<{
  src?: string
  alt?: string
  size?: VariantProps<typeof avatarVariants>['size']
  tone?: VariantProps<typeof avatarVariants>['tone']
  /** Green presence dot, announced as "Online". */
  online?: boolean
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
      aria-label="Online"
      :class="[
        'absolute right-0 bottom-0 block rounded-full bg-green ring-2 ring-surface',
        size === 'lg' ? 'size-4' : 'size-3',
      ]"
    />
  </AvatarRoot>
</template>
