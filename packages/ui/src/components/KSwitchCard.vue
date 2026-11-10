<script setup lang="ts">
import { useId } from 'vue'

import { cn } from '../lib/cn'
import KSwitch from './KSwitch.vue'

const {
  title,
  description,
  disabled = false,
  invalid = false,
  name,
  id,
  class: className,
} = defineProps<{
  title: string
  description?: string
  disabled?: boolean
  invalid?: boolean
  name?: string
  id?: string
  class?: string
}>()

const checked = defineModel<boolean>({ default: false })
const titleId = useId()
const descriptionId = useId()
</script>

<template>
  <!-- Whole card is the switch: the title is its name, the description its description. -->
  <KSwitch
    :id="id"
    v-model="checked"
    :disabled="disabled"
    :invalid="invalid"
    :name="name"
    :aria-labelledby="titleId"
    :aria-describedby="description ? descriptionId : undefined"
    :class="
      cn(
        'w-full flex-row-reverse justify-between gap-4 rounded-lg border border-line bg-surface-subtle px-4 py-3',
        className,
      )
    "
  >
    <span class="flex min-w-0 flex-1 flex-col">
      <span :id="titleId" class="text-base font-semibold">{{ title }}</span>
      <span v-if="description" :id="descriptionId" class="text-sm text-fg-muted">{{
        description
      }}</span>
    </span>
  </KSwitch>
</template>
