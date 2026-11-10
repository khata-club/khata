import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'

import { trackPageView } from './lib/analytics'
import { authClient } from './lib/auth'

declare module 'vue-router' {
  interface RouteMeta {
    title: string
    public?: boolean
  }
}

const page = (name: string, path: string, title: string, load: () => Promise<unknown>) =>
  ({ path, name, component: load, meta: { title } }) as RouteRecordRaw

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    name: 'home',
    component: () => import('./pages/LandingPage.vue'),
    meta: { title: 'Welcome', public: true },
  },
  {
    path: '/app',
    component: () => import('./components/AppShell.vue'),
    children: [
      page('dashboard', '', 'Overview', () => import('./pages/DashboardPage.vue')),
      page('onboarding', 'welcome', 'Set up', () => import('./pages/OnboardingPage.vue')),
      page('entries', 'entries', 'Entries', () => import('./pages/EntriesPage.vue')),
      page('accounts', 'accounts', 'Accounts', () => import('./pages/AccountsPage.vue')),
      page('budgets', 'budgets', 'Budgets', () => import('./pages/BudgetsPage.vue')),
      page('bills', 'bills', 'Bills, SIPs & EMIs', () => import('./pages/BillsPage.vue')),
      page('goals', 'goals', 'Goals', () => import('./pages/GoalsPage.vue')),
      page('net-worth', 'net-worth', 'Net worth', () => import('./pages/NetWorthPage.vue')),
      page('tax', 'tax', 'Tax saver', () => import('./pages/TaxPage.vue')),
      page('reports', 'reports', 'Reports', () => import('./pages/ReportsPage.vue')),
      page('import', 'import', 'Import & export', () => import('./pages/ImportExportPage.vue')),
      page('settings', 'settings', 'Settings', () => import('./pages/SettingsPage.vue')),
    ],
  },
  { path: '/:pathMatch(.*)*', redirect: '/' },
]

export const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior: () => ({ top: 0 }),
})

router.beforeEach(async (to) => {
  const { data } = await authClient.getSession()
  if (to.name === 'home') return data ? { name: 'dashboard' } : true
  if (!to.meta.public && !data) return { name: 'home' }
  return true
})

router.afterEach((to) => {
  document.title = `${to.meta.title} · khata money`
  trackPageView(String(to.name ?? 'unknown'), to.meta.title)
})

if (typeof window !== 'undefined') {
  window.addEventListener('khata:unauthorized', () => {
    if (!router.currentRoute.value.meta.public) router.replace({ name: 'home' })
  })
}
