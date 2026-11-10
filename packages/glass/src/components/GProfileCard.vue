<script setup lang="ts">
import { MapPin, UserRound } from '@lucide/vue'

import { cn } from '../lib/cn'
import GAvatar from './GAvatar.vue'

const {
  name,
  title,
  location,
  src,
  online = false,
  class: className,
} = defineProps<{
  name: string
  title?: string
  location?: string
  src?: string
  online?: boolean
  class?: string
}>()
</script>

<template>
  <div
    data-slot="profile-card"
    :class="cn('flex flex-col gap-5 rounded-xl bg-surface p-5 shadow-card', className)"
  >
    <div class="flex items-center gap-4">
      <GAvatar :src="src" :alt="name" :online="online" size="lg" tone="accent">
        <slot name="avatar"><UserRound aria-hidden="true" /></slot>
      </GAvatar>
      <div class="flex min-w-0 flex-1 flex-col">
        <span class="text-title-3 font-semibold">{{ name }}</span>
        <span v-if="title" class="text-subhead text-label-secondary">{{ title }}</span>
        <span
          v-if="location"
          class="mt-1 flex items-center gap-1.5 text-footnote text-label-secondary"
        >
          <MapPin :size="14" aria-hidden="true" class="shrink-0" />{{ location }}
        </span>
      </div>
      <div v-if="$slots.menu" class="shrink-0 self-start"><slot name="menu" /></div>
    </div>
    <div v-if="$slots.actions" class="flex gap-2 [&>*]:flex-1"><slot name="actions" /></div>
  </div>
</template>
