<script setup lang="ts">
defineProps<{ title: string; subtitle?: string; eyebrow?: string }>()
</script>

<template>
  <header class="flex flex-wrap items-end gap-4 border-b border-line pb-5">
    <div class="flex min-w-0 flex-1 flex-col gap-1">
      <span v-if="eyebrow" class="font-mono text-xs text-fg-muted">{{ eyebrow }}</span>
      <h1 class="m-0 text-3xl font-bold [text-wrap:balance]">{{ title }}</h1>
      <p v-if="subtitle" class="m-0 text-base text-fg-muted">{{ subtitle }}</p>
    </div>
    <div v-if="$slots.actions" class="flex flex-wrap items-center gap-2">
      <slot name="actions" />
    </div>
  </header>
</template>
