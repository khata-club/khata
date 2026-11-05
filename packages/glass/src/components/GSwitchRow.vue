<script setup lang="ts">
import type { Component } from 'vue'

import { cn } from '../lib/cn'
import GSwitch from './GSwitch.vue'

const {
  title,
  description,
  icon,
  iconColor = 'var(--color-accent)',
  disabled = false,
  class: className,
} = defineProps<{
  title: string
  description?: string
  icon?: Component
  iconColor?: string
  disabled?: boolean
  class?: string
}>()

const checked = defineModel<boolean>({ default: false })
</script>

<template>
  <!-- The whole row is the switch: its title and description form the accessible name. -->
  <div role="listitem" class="flex" :data-icon="icon ? '' : undefined">
    <GSwitch
      v-model="checked"
      :disabled="disabled"
      :class="cn('w-full flex-row-reverse justify-between gap-3 px-4 py-1.5', className)"
    >
      <span class="flex min-w-0 flex-1 items-center gap-3">
        <span
          v-if="icon"
          class="grid size-[30px] shrink-0 place-items-center rounded-[8px] text-white"
          :style="{ background: iconColor }"
        >
          <component :is="icon" :size="18" :stroke-width="2.25" aria-hidden="true" />
        </span>
        <span class="flex min-w-0 flex-col">
          <span class="text-body">{{ title }}</span>
          <span v-if="description" class="text-footnote text-label-secondary">{{
            description
          }}</span>
        </span>
      </span>
    </GSwitch>
  </div>
</template>
