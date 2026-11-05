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

import { loadMe, meError } from './lib/session'

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

const publicRoutes: RouteRecordRaw[] = [
  { path: '/sign-in', name: 'sign-in', component: () => import('./views/auth/SignInView.vue') },
  {
    path: '/sign-in/two-factor',
    name: 'two-factor',
    component: () => import('./views/auth/TwoFactorView.vue'),
  },
  { path: '/sign-up', name: 'sign-up', component: () => import('./views/auth/SignUpView.vue') },
  {
    path: '/forgot-password',
    name: 'forgot-password',
    component: () => import('./views/auth/ForgotPasswordView.vue'),
  },
  {
    path: '/reset-password',
    name: 'reset-password',
    component: () => import('./views/auth/ResetPasswordView.vue'),
  },
].map((r) => ({ ...r, meta: { public: true, bare: true } }) as RouteRecordRaw)

const routes: RouteRecordRaw[] = [
  ...publicRoutes,
  {
    path: '/onboarding',
    name: 'onboarding',
    component: () => import('./views/auth/OnboardingView.vue'),
    meta: { bare: true, allowWithoutOrganization: true },
  },
  {
    path: '/invite/:id',
    name: 'invite',
    component: () => import('./views/auth/AcceptInviteView.vue'),
    props: true,
    meta: { bare: true, allowWithoutOrganization: true },
  },
  { path: '/', name: 'overview', component: () => import('./views/OverviewView.vue') },
  { path: '/domains', name: 'domains', component: () => import('./views/domains/DomainsView.vue') },
  {
    path: '/domains/:id',
    name: 'domain',
    component: () => import('./views/domains/DomainDetailView.vue'),
    props: true,
  },
  {
    path: '/settings',
    name: 'settings',
    component: () => import('./views/settings/SettingsView.vue'),
  },
  ...sections
    .filter((s) => !['overview', 'settings', 'domains'].includes(s.name))
    .map((s): RouteRecordRaw => ({
      path: s.path,
      name: s.name,
      component: () => import('./views/ComingSoonView.vue'),
      props: { title: s.label },
    })),
  { path: '/:pathMatch(.*)*', redirect: '/' },
]

declare module 'vue-router' {
  interface RouteMeta {
    /** Reachable while signed out. */
    public?: boolean
    /** Rendered without the app shell. */
    bare?: boolean
    /** Reachable while signed in without an active organization. */
    allowWithoutOrganization?: boolean
  }
}

export const router = createRouter({ history: createWebHistory(), routes })

router.beforeEach(async (to) => {
  if (to.meta.public) return true
  const current = await loadMe()
  if (current) return true
  if (meError.value === 'no_active_organization' || meError.value === 'not_a_member') {
    return to.meta.allowWithoutOrganization ? true : { name: 'onboarding' }
  }
  if (meError.value === 'unauthenticated') {
    return { name: 'sign-in', query: to.fullPath === '/' ? {} : { redirect: to.fullPath } }
  }
  // Network or server error: let the page render and show its own error state.
  return true
})
