<script setup lang="ts">
import { cn } from '../lib/cn'
import GAvatar from './GAvatar.vue'

const {
  name,
  subtitle,
  initials,
  src,
  size = 'md',
  tone,
  class: className,
} = defineProps<{
  name: string
  subtitle?: string
  initials?: string
  src?: string
  size?: 'sm' | 'md'
  tone?: 'gray' | 'accent' | 'teal' | 'orange' | 'purple'
  class?: string
}>()
</script>

<template>
  <div
    data-slot="profile-summary"
    :class="cn('flex min-w-0 items-center', size === 'sm' ? 'gap-2.5' : 'gap-3', className)"
  >
    <GAvatar :size="size" :src="src" :alt="name" :tone="tone">{{ initials }}</GAvatar>
    <span class="flex min-w-0 flex-col">
      <span :class="cn('truncate font-semibold', size === 'sm' ? 'text-subhead' : 'text-body')">{{
        name
      }}</span>
      <span
        v-if="subtitle"
        :class="
          cn('truncate text-label-secondary', size === 'sm' ? 'text-caption' : 'text-footnote')
        "
      >
        {{ subtitle }}
      </span>
    </span>
  </div>
</template>
