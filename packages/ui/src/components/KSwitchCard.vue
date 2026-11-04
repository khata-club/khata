<script setup lang="ts">
import { cn } from '../lib/cn'
import KSwitch from './KSwitch.vue'

const {
  title,
  description,
  disabled = false,
  class: className,
} = defineProps<{
  title: string
  description?: string
  disabled?: boolean
  class?: string
}>()

const checked = defineModel<boolean>({ default: false })
</script>

<template>
  <!-- Whole card is the switch: title and description form its accessible name. -->
  <KSwitch
    v-model="checked"
    :disabled="disabled"
    :class="
      cn(
        'w-full flex-row-reverse justify-between gap-4 rounded-lg border border-line bg-surface-subtle px-4 py-3',
        className,
      )
    "
  >
    <span class="flex min-w-0 flex-1 flex-col">
      <span class="text-base font-semibold">{{ title }}</span>
      <span v-if="description" class="text-sm text-fg-muted">{{ description }}</span>
    </span>
  </KSwitch>
</template>
