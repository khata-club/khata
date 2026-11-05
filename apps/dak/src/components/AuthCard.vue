<script setup lang="ts">
import { KAlert } from '@khata/ui'

defineProps<{ title: string; subtitle?: string; error?: string }>()
</script>

<template>
  <div class="grid min-h-screen place-items-center bg-canvas px-4 py-10 font-sans text-fg">
    <div class="flex w-full max-w-[420px] flex-col gap-6">
      <p class="text-center text-2xl font-bold tracking-[0.04em]">
        dak<span class="font-medium text-primary">.khata</span>
      </p>
      <section
        class="flex flex-col gap-5 rounded-xl border border-line bg-surface p-6 shadow-raised sm:p-8"
      >
        <header class="flex flex-col gap-1">
          <h1 class="text-xl font-bold">{{ title }}</h1>
          <p v-if="subtitle" class="text-sm text-fg-muted">{{ subtitle }}</p>
        </header>
        <KAlert v-if="error" tone="danger" :title="error" :dismissible="false" />
        <slot />
      </section>
      <div class="text-center text-sm text-fg-muted"><slot name="footer" /></div>
    </div>
  </div>
</template>
