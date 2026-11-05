<script setup lang="ts">
import { MapPin, UserRound } from '@lucide/vue'

import { cn } from '../lib/cn'
import KAvatar from './KAvatar.vue'

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
    :class="
      cn(
        'flex flex-col gap-5 rounded-lg border border-line bg-surface p-5 shadow-raised-sm transition-[box-shadow,transform] duration-(--duration-normal) ease-standard hover:-translate-y-0.5 hover:shadow-raised',
        className,
      )
    "
  >
    <div class="flex items-center gap-5">
      <KAvatar
        :src="src"
        :alt="name"
        :online="online"
        class="size-[88px] text-primary [&_svg]:size-11"
      >
        <slot name="avatar"><UserRound aria-hidden="true" /></slot>
      </KAvatar>
      <div class="flex min-w-0 flex-1 flex-col gap-0.5">
        <span class="text-xl font-bold">{{ name }}</span>
        <span v-if="title" class="text-base text-fg-muted">{{ title }}</span>
        <span v-if="location" class="mt-1 flex items-center gap-2 text-sm text-fg-muted">
          <MapPin :size="16" aria-hidden="true" class="shrink-0" />{{ location }}
        </span>
      </div>
      <div v-if="$slots.menu" class="shrink-0 self-start"><slot name="menu" /></div>
    </div>
    <div v-if="$slots.actions" class="flex gap-3 [&>*]:flex-1"><slot name="actions" /></div>
  </div>
</template>
