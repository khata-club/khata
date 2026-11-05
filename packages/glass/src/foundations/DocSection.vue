<script setup lang="ts">
defineProps<{ title: string; subtitle?: string }>()
</script>

<template>
  <section class="flex max-w-[1100px] flex-col gap-5">
    <header class="flex flex-col gap-1">
      <h2 class="m-0 text-title-2 font-semibold">{{ title }}</h2>
      <p v-if="subtitle" class="m-0 text-subhead text-label-secondary">{{ subtitle }}</p>
    </header>
    <slot />
  </section>
</template>
