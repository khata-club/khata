<script setup lang="ts">
import { useId } from 'vue'

const { title } = defineProps<{ title?: string }>()
const id = useId()
</script>

<template>
  <div data-slot="sidebar-section" role="group" :aria-labelledby="title ? id : undefined">
    <p
      v-if="title"
      :id="id"
      class="mb-1 px-3 text-xs font-semibold tracking-wide text-fg-muted uppercase"
    >
      {{ title }}
    </p>
    <div class="flex flex-col gap-0.5"><slot /></div>
  </div>
</template>
