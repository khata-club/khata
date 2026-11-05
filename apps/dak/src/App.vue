<script setup lang="ts">
import { KAppShell, KNavItem, KSidebar, KSidebarSection, KToaster, KTopbar } from '@khata/ui'
import { computed, ref, watch } from 'vue'
import { RouterLink, RouterView, useRoute } from 'vue-router'

import { sectionGroups, sections } from './router'

const route = useRoute()
const sidebarOpen = ref(false)
const title = computed(() => sections.find((s) => s.name === route.name)?.label)

watch(
  () => route.fullPath,
  () => (sidebarOpen.value = false),
)
</script>

<template>
  <KAppShell v-model:sidebar-open="sidebarOpen">
    <template #sidebar>
      <KSidebar label="Dashboard">
        <template #header>
          <RouterLink
            to="/"
            class="flex items-baseline gap-0.5 text-xl font-bold tracking-[0.04em] text-fg no-underline"
          >
            dak<span class="font-medium text-primary">.khata</span>
          </RouterLink>
        </template>
        <KSidebarSection v-for="g in sectionGroups" :key="g.title" :title="g.title || undefined">
          <KNavItem
            v-for="s in g.items"
            :key="s.name"
            :as="RouterLink"
            :to="s.path"
            :icon="s.icon"
            :current="route.name === s.name"
            class="no-underline"
          >
            {{ s.label }}
          </KNavItem>
        </KSidebarSection>
      </KSidebar>
    </template>

    <template #topbar>
      <KTopbar :title="title" @menu="sidebarOpen = true" />
    </template>

    <RouterView />
    <KToaster />
  </KAppShell>
</template>
