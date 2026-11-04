<script setup lang="ts">
defineProps<{ index: string; title: string; meta?: string }>()
</script>

<template>
  <article
    class="flex max-w-[1100px] flex-col gap-6 rounded-xl border border-line bg-surface p-8 shadow-raised"
  >
    <header class="flex flex-wrap items-baseline gap-4">
      <span class="font-mono text-sm text-fg-muted">{{ index }}</span>
      <h3 class="m-0 text-sm font-semibold tracking-label uppercase">{{ title }}</h3>
      <span v-if="meta" class="ml-auto font-mono text-xs text-fg-muted">{{ meta }}</span>
    </header>
    <slot />
  </article>
</template>
