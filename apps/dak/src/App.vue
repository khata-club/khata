<script setup lang="ts">
import {
  KAppShell,
  KAvatar,
  KMenu,
  KMenuContent,
  KMenuItem,
  KMenuTrigger,
  KNavItem,
  KSidebar,
  KSidebarSection,
  KToaster,
  KTopbar,
} from '@khata/ui'
import { LogOut } from '@lucide/vue'
import { computed, ref, watch } from 'vue'
import { RouterLink, RouterView, useRoute, useRouter } from 'vue-router'

import ContextSwitcher from './components/ContextSwitcher.vue'
import { authClient } from './lib/auth'
import { me } from './lib/session'
import { sectionGroups, sections } from './router'

const route = useRoute()
const router = useRouter()

async function signOut() {
  await authClient.signOut()
  me.value = undefined
  await router.replace('/sign-in')
}
const sidebarOpen = ref(false)
const initials = computed(() =>
  (me.value?.user.name ?? '?')
    .split(/\s+/)
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase(),
)
/** Detail routes highlight their section. */
const parentOf: Record<string, string> = {
  domain: 'domains',
  template: 'templates',
  email: 'emails',
}
const title = computed(
  () => sections.find((s) => s.name === (parentOf[String(route.name)] ?? route.name))?.label,
)

watch(
  () => route.fullPath,
  () => (sidebarOpen.value = false),
)
</script>

<template>
  <template v-if="route.meta.bare">
    <RouterView />
    <KToaster />
  </template>
  <KAppShell v-else v-model:sidebar-open="sidebarOpen">
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
        <ContextSwitcher />
        <KSidebarSection v-for="g in sectionGroups" :key="g.title" :title="g.title || undefined">
          <KNavItem
            v-for="s in g.items"
            :key="s.name"
            :as="RouterLink"
            :to="s.path"
            :icon="s.icon"
            :current="route.name === s.name || parentOf[String(route.name)] === s.name"
            class="no-underline"
          >
            {{ s.label }}
          </KNavItem>
        </KSidebarSection>
      </KSidebar>
    </template>

    <template #topbar>
      <KTopbar :title="title" @menu="sidebarOpen = true">
        <template v-if="me" #actions>
          <KMenu>
            <KMenuTrigger>
              <button
                type="button"
                class="cursor-pointer rounded-full border-0 bg-transparent p-0"
                :aria-label="`Account menu for ${me.user.name}`"
              >
                <KAvatar size="sm">{{ initials }}</KAvatar>
              </button>
            </KMenuTrigger>
            <KMenuContent align="end">
              <div class="max-w-64 px-3 py-2 text-sm">
                <p class="font-semibold">{{ me.user.name }}</p>
                <p class="truncate text-fg-muted">{{ me.user.email }}</p>
                <p class="text-xs text-fg-muted capitalize">{{ me.role }}</p>
              </div>
              <KMenuItem @select="signOut"><LogOut :size="16" /> Sign out</KMenuItem>
            </KMenuContent>
          </KMenu>
        </template>
      </KTopbar>
    </template>

    <RouterView />
    <KToaster />
  </KAppShell>
</template>
