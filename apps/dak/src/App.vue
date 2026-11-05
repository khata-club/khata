<script setup lang="ts">
import { RouterLink, RouterView } from 'vue-router'

import { sections } from './router'
</script>

<template>
  <div class="min-h-screen bg-canvas font-sans text-fg">
    <header class="sticky top-0 z-10 border-b border-line bg-white/86 backdrop-blur-[10px]">
      <div class="mx-auto flex max-w-[1180px] items-center gap-6 px-6 py-4">
        <RouterLink
          to="/"
          class="flex items-baseline gap-0.5 text-xl font-bold tracking-[0.04em] text-fg no-underline"
        >
          dak<span class="font-medium text-primary">.khata</span>
        </RouterLink>
      </div>
    </header>

    <div class="mx-auto flex max-w-[1180px] gap-8 px-6 py-8 max-md:flex-col">
      <!-- Replaced by KAppShell / KSidebar from @khata/ui in Dak 2/22. -->
      <nav aria-label="Sections" class="flex w-56 shrink-0 flex-col gap-1 max-md:w-full">
        <RouterLink
          v-for="s in sections"
          :key="s.name"
          :to="s.path"
          class="rounded-md px-3 py-2 text-sm font-semibold text-fg-muted no-underline hover:bg-surface-recessed hover:text-fg"
          exact-active-class="bg-primary-subtle text-primary-pressed"
        >
          {{ s.label }}
        </RouterLink>
      </nav>

      <main class="min-w-0 flex-1">
        <RouterView />
      </main>
    </div>
  </div>
</template>
