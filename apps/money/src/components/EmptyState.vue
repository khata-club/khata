<script setup lang="ts">
import type { Component } from 'vue'

defineProps<{ icon: Component; title: string; body?: string }>()
</script>

<template>
  <div
    class="flex flex-col items-center gap-3 rounded-xl border border-dashed border-line bg-surface-subtle px-6 py-12 text-center"
  >
    <span class="grid size-12 place-items-center rounded-full bg-primary-subtle text-primary">
      <component :is="icon" :size="22" aria-hidden="true" />
    </span>
    <h2 class="m-0 text-lg font-semibold">{{ title }}</h2>
    <p v-if="body" class="m-0 max-w-[420px] text-sm text-fg-muted">{{ body }}</p>
    <div v-if="$slots.default" class="mt-2 flex flex-wrap justify-center gap-2"><slot /></div>
  </div>
</template>
