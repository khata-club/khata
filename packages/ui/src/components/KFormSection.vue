<script setup lang="ts">
import { useId } from 'vue'

import { cn } from '../lib/cn'

const {
  title,
  description,
  headingLevel = 2,
  class: className,
} = defineProps<{
  title: string
  description?: string
  /** Heading level of the title (2 = <h2>); the title also names the form. */
  headingLevel?: 2 | 3 | 4 | 5 | 6
  class?: string
}>()

const titleId = useId()
const descriptionId = useId()

defineEmits<{ submit: [event: SubmitEvent] }>()
</script>

<template>
  <form
    data-slot="form-section"
    :aria-labelledby="titleId"
    :aria-describedby="description ? descriptionId : undefined"
    :class="cn('flex flex-col gap-5', className)"
    @submit.prevent="$emit('submit', $event as SubmitEvent)"
  >
    <div class="flex flex-col gap-1">
      <component :is="`h${headingLevel}`" :id="titleId" class="m-0 text-xl font-semibold">
        {{ title }}
      </component>
      <p v-if="description" :id="descriptionId" class="m-0 text-sm text-fg-muted">
        {{ description }}
      </p>
    </div>
    <slot />
    <div v-if="$slots.footer" class="flex flex-wrap items-center gap-3">
      <slot name="footer" />
    </div>
  </form>
</template>
