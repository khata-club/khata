<script setup lang="ts">
import { cn } from '../lib/cn'

const {
  title,
  description,
  class: className,
} = defineProps<{
  title: string
  description?: string
  class?: string
}>()

defineEmits<{ submit: [event: SubmitEvent] }>()
</script>

<template>
  <form
    data-slot="form-section"
    :class="cn('flex flex-col gap-5', className)"
    @submit.prevent="$emit('submit', $event as SubmitEvent)"
  >
    <div class="flex flex-col gap-1">
      <span class="text-title-3 font-semibold">{{ title }}</span>
      <span v-if="description" class="text-subhead text-label-secondary">{{ description }}</span>
    </div>
    <slot />
    <div v-if="$slots.footer" class="flex flex-wrap items-center gap-3">
      <slot name="footer" />
    </div>
  </form>
</template>
