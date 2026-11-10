<script setup lang="ts">
import { cn } from '../lib/cn'
import KAvatar from './KAvatar.vue'

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
  tone?: 'subtle' | 'soft' | 'primary' | 'muted'
  class?: string
}>()
</script>

<template>
  <div
    data-slot="profile-summary"
    :class="cn('flex min-w-0 items-center', size === 'sm' ? 'gap-2' : 'gap-3', className)"
  >
    <KAvatar
      :size="size"
      :src="src"
      alt=""
      :tone="tone ?? (size === 'sm' ? 'primary' : 'subtle')"
      :class="size === 'sm' ? 'shadow-none' : undefined"
    >
      {{ initials }}
    </KAvatar>
    <span class="flex min-w-0 flex-col">
      <span :class="cn('truncate font-semibold', size === 'sm' ? 'text-sm' : 'text-base')">{{
        name
      }}</span>
      <span
        v-if="subtitle"
        :class="cn('truncate text-fg-muted', size === 'sm' ? 'text-xs' : 'text-sm')"
      >
        {{ subtitle }}
      </span>
    </span>
  </div>
</template>
