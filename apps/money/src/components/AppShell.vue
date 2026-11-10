<script setup lang="ts">
import {
  KBottomNav,
  KButton,
  KChartProvider,
  KDialog,
  KNavItem,
  KProfileSummary,
  KSpinner,
  type BottomNavItem,
} from '@khata/ui'
import {
  CalendarClock,
  ChartPie,
  FileSpreadsheet,
  Landmark,
  LayoutDashboard,
  LogOut,
  Menu,
  PiggyBank,
  Plus,
  ReceiptText,
  Scale,
  Settings,
  Target,
  Wallet,
} from '@lucide/vue'
import { useQueryClient } from '@tanstack/vue-query'
import { computed, ref, watch, type Component } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { openEntry } from '@/composables/useEntryDialog'
import { track } from '@/lib/analytics'
import { signOut } from '@/lib/auth'
import { useMe, useRecurring } from '@/lib/queries'
import { dueState } from '#shared/plan'
import { todayIST } from '#shared/dates'

import EntryDialog from './EntryDialog.vue'

const route = useRoute()
const router = useRouter()
const qc = useQueryClient()
const me = useMe()
const recurring = useRecurring()

interface NavLink {
  name: string
  label: string
  icon: Component
}
const groups: { label: string; items: NavLink[] }[] = [
  {
    label: 'Daily',
    items: [
      { name: 'dashboard', label: 'Overview', icon: LayoutDashboard },
      { name: 'entries', label: 'Entries', icon: ReceiptText },
      { name: 'accounts', label: 'Accounts', icon: Wallet },
    ],
  },
  {
    label: 'Plan',
    items: [
      { name: 'budgets', label: 'Budgets', icon: PiggyBank },
      { name: 'bills', label: 'Bills, SIPs & EMIs', icon: CalendarClock },
      { name: 'goals', label: 'Goals', icon: Target },
    ],
  },
  {
    label: 'Wealth',
    items: [
      { name: 'net-worth', label: 'Net worth', icon: Scale },
      { name: 'tax', label: 'Tax saver', icon: Landmark },
      { name: 'reports', label: 'Reports', icon: ChartPie },
    ],
  },
  {
    label: 'Data',
    items: [
      { name: 'import', label: 'Import & export', icon: FileSpreadsheet },
      { name: 'settings', label: 'Settings', icon: Settings },
    ],
  },
]

const dueCount = computed(
  () =>
    (recurring.data.value ?? []).filter(
      (r) => r.active && dueState(r.nextDueOn, todayIST(), 3) !== 'later',
    ).length || undefined,
)

// Mobile bottom navigation.
const bottomItems: BottomNavItem[] = [
  { value: 'dashboard', label: 'Home', icon: LayoutDashboard },
  { value: 'entries', label: 'Entries', icon: ReceiptText },
  { value: 'add', label: 'Add', icon: Plus },
  { value: 'budgets', label: 'Budgets', icon: PiggyBank },
  { value: 'more', label: 'More', icon: Menu },
]
const moreOpen = ref(false)
const bottomValue = computed({
  get: () =>
    ['dashboard', 'entries', 'budgets'].includes(String(route.name)) ? String(route.name) : 'more',
  set: (v: string) => {
    if (v === 'add') openEntry({ source: 'quick_add' })
    else if (v === 'more') moreOpen.value = true
    else router.push({ name: v })
  },
})

function go(name: string) {
  moreOpen.value = false
  router.push({ name })
}

// First run → onboarding. Also record sign-in vs sign-up once after the OAuth redirect.
watch(
  () => me.data.value,
  (m) => {
    if (!m) return
    if (route.query.signed_in) {
      track(m.prefs.onboarded ? 'login' : 'sign_up', { method: 'google' })
      router.replace({ query: {} })
    }
    if (!m.prefs.onboarded && route.name !== 'onboarding') router.replace({ name: 'onboarding' })
  },
  { immediate: true },
)

const initials = computed(() =>
  (me.data.value?.user.name ?? '')
    .split(/\s+/)
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase(),
)

async function logout() {
  track('logout', {})
  await signOut()
  qc.clear()
  router.replace({ name: 'home' })
}

const onboarding = computed(() => route.name === 'onboarding')
</script>

<template>
  <KChartProvider>
    <div class="min-h-dvh bg-canvas font-sans text-fg">
      <!-- Desktop sidebar -->
      <aside
        v-if="!onboarding"
        class="fixed inset-y-0 left-0 z-20 hidden w-[264px] flex-col gap-6 overflow-y-auto border-r border-line bg-surface px-4 py-6 lg:flex"
      >
        <RouterLink
          :to="{ name: 'dashboard' }"
          class="flex items-baseline gap-0.5 px-3 text-xl font-bold tracking-[0.04em] text-fg no-underline"
        >
          khata<span class="font-medium text-primary">.money</span>
        </RouterLink>
        <KButton class="mx-1 gap-2" @click="openEntry({ source: 'quick_add' })">
          <Plus :size="18" aria-hidden="true" /> Add entry
        </KButton>
        <nav aria-label="Main" class="flex flex-col gap-5">
          <div v-for="g in groups" :key="g.label" class="flex flex-col gap-1">
            <span class="px-3 text-xs font-semibold tracking-label text-fg-muted uppercase">{{
              g.label
            }}</span>
            <KNavItem
              v-for="l in g.items"
              :key="l.name"
              as="a"
              :href="router.resolve({ name: l.name }).href"
              :icon="l.icon"
              :current="route.name === l.name"
              :badge="l.name === 'bills' ? dueCount : undefined"
              @click.prevent="router.push({ name: l.name })"
            >
              {{ l.label }}
            </KNavItem>
          </div>
        </nav>
        <div class="mt-auto flex items-center gap-2 border-t border-line px-1 pt-4">
          <KProfileSummary
            v-if="me.data.value"
            :name="me.data.value.user.name"
            :subtitle="me.data.value.user.email"
            :initials="initials"
            :src="me.data.value.user.image ?? undefined"
            size="sm"
            class="min-w-0 flex-1"
          />
          <KButton variant="ghost" size="sm" icon-only aria-label="Sign out" @click="logout">
            <LogOut :size="18" />
          </KButton>
        </div>
      </aside>

      <!-- Mobile top bar -->
      <header
        v-if="!onboarding"
        class="sticky top-0 z-20 flex items-center gap-3 border-b border-line bg-surface/90 px-4 py-3 backdrop-blur-[10px] lg:hidden"
      >
        <RouterLink
          :to="{ name: 'dashboard' }"
          class="flex items-baseline gap-0.5 text-lg font-bold tracking-[0.04em] text-fg no-underline"
        >
          khata<span class="font-medium text-primary">.money</span>
        </RouterLink>
        <span class="ml-auto truncate text-sm font-semibold text-fg-muted">{{
          route.meta.title
        }}</span>
      </header>

      <div :class="onboarding ? '' : 'lg:pl-[264px]'">
        <main
          :class="[
            'mx-auto flex max-w-[1120px] flex-col gap-8 px-4 py-6 sm:px-6 lg:py-10',
            onboarding ? '' : 'pb-36 lg:pb-16',
          ]"
        >
          <div v-if="me.isPending.value" class="grid place-items-center py-24 text-primary">
            <KSpinner class="size-6" />
          </div>
          <RouterView v-else />
        </main>
      </div>

      <!-- Mobile bottom navigation -->
      <div v-if="!onboarding" class="fixed inset-x-0 bottom-0 z-30 px-3 pb-3 lg:hidden">
        <KBottomNav v-model="bottomValue" :items="bottomItems" label="Main" />
      </div>

      <KDialog
        v-model:open="moreOpen"
        title="Everything else"
        class="max-h-[calc(100dvh-32px)] overflow-y-auto"
      >
        <nav aria-label="More" class="flex flex-col gap-4">
          <div v-for="g in groups" :key="g.label" class="flex flex-col gap-1">
            <span class="px-3 text-xs font-semibold tracking-label text-fg-muted uppercase">{{
              g.label
            }}</span>
            <KNavItem
              v-for="l in g.items"
              :key="l.name"
              :icon="l.icon"
              :current="route.name === l.name"
              :badge="l.name === 'bills' ? dueCount : undefined"
              @click="go(l.name)"
              >{{ l.label }}</KNavItem
            >
          </div>
          <KNavItem :icon="LogOut" @click="logout">Sign out</KNavItem>
        </nav>
      </KDialog>

      <EntryDialog />
    </div>
  </KChartProvider>
</template>
