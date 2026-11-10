<script setup lang="ts">
defineProps<{ title: string }>()
</script>

<template>
  <section class="flex flex-col gap-2 border-b border-line px-3 py-3">
    <div class="flex items-center gap-2">
      <h3 class="k-panel-title flex-1">{{ title }}</h3>
      <slot name="actions" />
    </div>
    <slot />
  </section>
</template>
