import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'

/** Dashboard sections in spec §12 order. Sections ship in later Dak PRs. */
export const sections = [
  { name: 'overview', path: '/', label: 'Overview' },
  { name: 'emails', path: '/emails', label: 'Emails' },
  { name: 'templates', path: '/templates', label: 'Templates' },
  { name: 'analytics', path: '/analytics', label: 'Analytics' },
  { name: 'monitoring', path: '/monitoring', label: 'Monitoring' },
  { name: 'domains', path: '/domains', label: 'Domains' },
  { name: 'developers', path: '/developers', label: 'API keys & webhooks' },
  { name: 'billing', path: '/billing', label: 'Usage & billing' },
  { name: 'settings', path: '/settings', label: 'Team & settings' },
] as const

const routes: RouteRecordRaw[] = [
  { path: '/', name: 'overview', component: () => import('./views/OverviewView.vue') },
  ...sections
    .filter((s) => s.name !== 'overview')
    .map((s): RouteRecordRaw => ({
      path: s.path,
      name: s.name,
      component: () => import('./views/ComingSoonView.vue'),
      props: { title: s.label },
    })),
  { path: '/:pathMatch(.*)*', redirect: '/' },
]

export const router = createRouter({ history: createWebHistory(), routes })
