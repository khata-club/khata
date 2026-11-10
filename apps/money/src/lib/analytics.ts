/**
 * GA4 via gtag.js with Consent Mode v2.
 *
 * - Nothing loads unless VITE_GA_MEASUREMENT_ID is set.
 * - analytics_storage starts denied; ad_* signals are always denied.
 * - Events never carry amounts, names, payees, notes, emails or ids; counts are bucketed.
 * - Page views are sent manually per route with the route *name* (no ids in paths).
 */
import type {
  AccountType,
  HoldingKind,
  PaymentMode,
  RecurringKind,
  TxnType,
} from '#shared/constants'

const GA_ID = import.meta.env.VITE_GA_MEASUREMENT_ID as string | undefined
const CONSENT_KEY = 'khata-money:analytics-consent'

type Source = 'quick_add' | 'form' | 'recurring'
export interface AnalyticsEvents {
  page_view: { page_title: string; page_location: string; page_path: string }
  login: { method: 'google' }
  sign_up: { method: 'google' }
  logout: Record<string, never>
  onboarding_step: { step: number; step_name: string }
  onboarding_complete: { accounts_bucket: string }
  account_create: { account_type: AccountType }
  account_archive: { account_type: AccountType }
  transaction_add: {
    txn_type: TxnType
    category: string
    payment_mode: PaymentMode | 'none'
    source: Source
  }
  transaction_edit: { txn_type: TxnType }
  transaction_delete: { txn_type: TxnType }
  category_create: { kind: 'expense' | 'income' }
  budget_set: { category: string }
  budget_copy: { count_bucket: string }
  recurring_create: { kind: RecurringKind }
  recurring_mark_paid: { kind: RecurringKind }
  goal_create: Record<string, never>
  goal_contribute: { direction: 'add' | 'withdraw' }
  holding_add: { kind: HoldingKind }
  holding_update: { kind: HoldingKind }
  tax_view: { fy: string }
  tax_declaration_add: { section: string }
  report_view: { report: string }
  export_csv: { rows_bucket: string }
  import_csv_start: Record<string, never>
  import_csv_complete: { rows_bucket: string; duplicates_bucket: string }
  consent_update: { granted: boolean }
  data_delete: { scope: 'data' | 'account' }
}

declare global {
  interface Window {
    dataLayer: unknown[]
    gtag?: (...args: unknown[]) => void
  }
}

let started = false

// gtag.js only processes real `arguments` objects pushed onto dataLayer, not arrays.
function gtag(..._args: unknown[]): void
function gtag() {
  window.dataLayer = window.dataLayer || []
  // eslint-disable-next-line prefer-rest-params
  window.dataLayer.push(arguments)
}

export function storedConsent(): boolean | null {
  try {
    const v = localStorage.getItem(CONSENT_KEY)
    return v === null ? null : v === 'granted'
  } catch {
    return null
  }
}

/** Load gtag.js with consent denied by default (call once at startup). */
export function initAnalytics() {
  if (started || !GA_ID || typeof window === 'undefined') return
  started = true
  window.dataLayer = window.dataLayer || []
  window.gtag = gtag
  const consent = storedConsent()
  gtag('consent', 'default', {
    analytics_storage: consent ? 'granted' : 'denied',
    ad_storage: 'denied',
    ad_user_data: 'denied',
    ad_personalization: 'denied',
    wait_for_update: 500,
  })
  gtag('js', new Date())
  gtag('config', GA_ID, { send_page_view: false, anonymize_ip: true })
  const s = document.createElement('script')
  s.async = true
  s.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(GA_ID)}`
  document.head.appendChild(s)
}

export function setConsent(granted: boolean) {
  try {
    localStorage.setItem(CONSENT_KEY, granted ? 'granted' : 'denied')
  } catch {
    /* private mode: keep the in-memory choice only */
  }
  if (GA_ID) gtag('consent', 'update', { analytics_storage: granted ? 'granted' : 'denied' })
  track('consent_update', { granted })
}

/** Send a typed GA4 event. In dev without an ID, events log to the console instead. */
export function track<E extends keyof AnalyticsEvents>(name: E, params: AnalyticsEvents[E]) {
  if (!GA_ID) {
    if (import.meta.env.DEV) console.debug('[analytics]', name, params)
    return
  }
  gtag('event', name, params)
}

export function trackPageView(routeName: string, title: string) {
  const path = `/${routeName}`
  track('page_view', {
    page_title: title,
    page_path: path,
    page_location: `${location.origin}${path}`,
  })
}
