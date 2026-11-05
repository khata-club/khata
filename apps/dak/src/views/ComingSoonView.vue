<script setup lang="ts">
defineProps<{ title: string }>()
</script>

<template>
  <section class="flex flex-col gap-3">
    <h1 class="text-2xl font-bold">{{ title }}</h1>
    <p class="text-fg-muted">This section arrives in a later Dak release.</p>
  </section>
</template>
