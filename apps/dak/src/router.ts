import {
  Activity,
  BarChart3,
  CreditCard,
  FileCode2,
  Globe,
  KeyRound,
  LayoutDashboard,
  Mail,
  Settings,
} from '@lucide/vue'
import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'

/** Dashboard sections in spec §12 order. Sections ship in later Dak PRs. */
export const sections = [
  { name: 'overview', path: '/', label: 'Overview', group: '', icon: LayoutDashboard },
  { name: 'emails', path: '/emails', label: 'Emails', group: 'Send', icon: Mail },
  { name: 'templates', path: '/templates', label: 'Templates', group: 'Send', icon: FileCode2 },
  { name: 'domains', path: '/domains', label: 'Domains', group: 'Send', icon: Globe },
  { name: 'analytics', path: '/analytics', label: 'Analytics', group: 'Observe', icon: BarChart3 },
  {
    name: 'monitoring',
    path: '/monitoring',
    label: 'Monitoring',
    group: 'Observe',
    icon: Activity,
  },
  {
    name: 'developers',
    path: '/developers',
    label: 'API keys & webhooks',
    group: 'Configure',
    icon: KeyRound,
  },
  {
    name: 'billing',
    path: '/billing',
    label: 'Usage & billing',
    group: 'Configure',
    icon: CreditCard,
  },
  {
    name: 'settings',
    path: '/settings',
    label: 'Team & settings',
    group: 'Configure',
    icon: Settings,
  },
] as const

/** Sidebar groups in display order. */
export const sectionGroups = ['', 'Send', 'Observe', 'Configure'].map((title) => ({
  title,
  items: sections.filter((s) => s.group === title),
}))

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
