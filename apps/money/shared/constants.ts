/** Fixed vocabularies shared by the API, the database and the UI. */

export const ACCOUNT_TYPES = ['savings', 'current', 'cash', 'wallet', 'credit_card'] as const
export type AccountType = (typeof ACCOUNT_TYPES)[number]
export const ACCOUNT_TYPE_LABEL: Record<AccountType, string> = {
  savings: 'Savings account',
  current: 'Current account',
  cash: 'Cash',
  wallet: 'UPI / wallet',
  credit_card: 'Credit card',
}
/** Liability accounts: balance is what you owe (stored negative). */
export const isLiability = (t: AccountType) => t === 'credit_card'

export const TXN_TYPES = ['expense', 'income', 'transfer'] as const
export type TxnType = (typeof TXN_TYPES)[number]

export const PAYMENT_MODES = [
  'upi',
  'cash',
  'debit_card',
  'credit_card',
  'netbanking',
  'cheque',
  'auto_debit',
] as const
export type PaymentMode = (typeof PAYMENT_MODES)[number]
export const PAYMENT_MODE_LABEL: Record<PaymentMode, string> = {
  upi: 'UPI',
  cash: 'Cash',
  debit_card: 'Debit card',
  credit_card: 'Credit card',
  netbanking: 'Net banking',
  cheque: 'Cheque',
  auto_debit: 'Auto-debit / NACH',
}
/** Sensible default payment mode for an account type. */
export const DEFAULT_MODE: Record<AccountType, PaymentMode> = {
  savings: 'upi',
  current: 'netbanking',
  cash: 'cash',
  wallet: 'upi',
  credit_card: 'credit_card',
}

export const TAX_SECTIONS = ['80C', '80D', '80CCD1B'] as const
export type TaxSection = (typeof TAX_SECTIONS)[number]
export const TAX_SECTION_LABEL: Record<TaxSection, string> = {
  '80C': '80C · PPF, ELSS, EPF, LIC, tuition, home-loan principal',
  '80D': '80D · Health insurance premiums',
  '80CCD1B': '80CCD(1B) · Extra NPS contribution',
}

export const RECURRING_KINDS = ['bill', 'sip', 'emi'] as const
export type RecurringKind = (typeof RECURRING_KINDS)[number]
export const RECURRING_KIND_LABEL: Record<RecurringKind, string> = {
  bill: 'Bill',
  sip: 'SIP',
  emi: 'EMI',
}

export const FREQUENCIES = ['monthly', 'quarterly', 'half_yearly', 'yearly'] as const
export type Frequency = (typeof FREQUENCIES)[number]
export const FREQUENCY_MONTHS: Record<Frequency, number> = {
  monthly: 1,
  quarterly: 3,
  half_yearly: 6,
  yearly: 12,
}
export const FREQUENCY_LABEL: Record<Frequency, string> = {
  monthly: 'Monthly',
  quarterly: 'Quarterly',
  half_yearly: 'Every 6 months',
  yearly: 'Yearly',
}

export const HOLDING_KINDS = [
  'fd',
  'rd',
  'ppf',
  'epf',
  'nps',
  'mutual_fund',
  'stocks',
  'gold',
  'real_estate',
  'other',
] as const
export type HoldingKind = (typeof HOLDING_KINDS)[number]
export const HOLDING_KIND_LABEL: Record<HoldingKind, string> = {
  fd: 'Fixed deposit',
  rd: 'Recurring deposit',
  ppf: 'PPF',
  epf: 'EPF',
  nps: 'NPS',
  mutual_fund: 'Mutual funds',
  stocks: 'Stocks',
  gold: 'Gold / SGB',
  real_estate: 'Real estate',
  other: 'Other',
}

export const CATEGORY_KINDS = ['expense', 'income'] as const
export type CategoryKind = (typeof CATEGORY_KINDS)[number]

/** Icon names map to Lucide components in the UI (see src/lib/icons.ts). */
export const CATEGORY_ICONS = [
  'shopping-basket',
  'home',
  'zap',
  'smartphone',
  'fuel',
  'hand-helping',
  'graduation-cap',
  'stethoscope',
  'shield',
  'landmark',
  'utensils',
  'shopping-bag',
  'plane',
  'gift',
  'heart',
  'trending-up',
  'briefcase',
  'laptop',
  'percent',
  'coins',
  'building',
  'rotate-ccw',
  'car',
  'film',
  'wifi',
  'droplet',
  'circle',
] as const
export type CategoryIcon = (typeof CATEGORY_ICONS)[number]

export interface DefaultCategory {
  key: string
  kind: CategoryKind
  name: string
  icon: CategoryIcon
  color: string
}

/** Seeded for every new user; editable afterwards. */
export const DEFAULT_CATEGORIES: DefaultCategory[] = [
  {
    key: 'groceries',
    kind: 'expense',
    name: 'Groceries & kirana',
    icon: 'shopping-basket',
    color: '#2f7d4f',
  },
  { key: 'rent', kind: 'expense', name: 'Rent', icon: 'home', color: '#3d5a99' },
  {
    key: 'electricity',
    kind: 'expense',
    name: 'Electricity & water',
    icon: 'zap',
    color: '#c08a1e',
  },
  {
    key: 'recharge',
    kind: 'expense',
    name: 'Mobile, DTH & internet',
    icon: 'smartphone',
    color: '#6b5bb5',
  },
  { key: 'fuel', kind: 'expense', name: 'Fuel & transport', icon: 'fuel', color: '#b5583d' },
  { key: 'help', kind: 'expense', name: 'Domestic help', icon: 'hand-helping', color: '#7a6a4f' },
  {
    key: 'education',
    kind: 'expense',
    name: 'School & tuition fees',
    icon: 'graduation-cap',
    color: '#2c7a8c',
  },
  { key: 'medical', kind: 'expense', name: 'Medical', icon: 'stethoscope', color: '#c0504d' },
  {
    key: 'insurance',
    kind: 'expense',
    name: 'Insurance premium',
    icon: 'shield',
    color: '#4f6d7a',
  },
  { key: 'emi', kind: 'expense', name: 'Loan EMI', icon: 'landmark', color: '#5a4a7a' },
  {
    key: 'dining',
    kind: 'expense',
    name: 'Dining & food delivery',
    icon: 'utensils',
    color: '#d0703a',
  },
  { key: 'shopping', kind: 'expense', name: 'Shopping', icon: 'shopping-bag', color: '#a3507a' },
  { key: 'travel', kind: 'expense', name: 'Travel', icon: 'plane', color: '#3b82a0' },
  { key: 'festivals', kind: 'expense', name: 'Festivals & gifts', icon: 'gift', color: '#c2410c' },
  { key: 'donations', kind: 'expense', name: 'Donations', icon: 'heart', color: '#be4b6b' },
  {
    key: 'investments',
    kind: 'expense',
    name: 'Investments & SIPs',
    icon: 'trending-up',
    color: '#1f7a6a',
  },
  {
    key: 'entertainment',
    kind: 'expense',
    name: 'Entertainment & OTT',
    icon: 'film',
    color: '#7c5cbf',
  },
  { key: 'other_expense', kind: 'expense', name: 'Other', icon: 'circle', color: '#6b7280' },
  { key: 'salary', kind: 'income', name: 'Salary', icon: 'briefcase', color: '#2563eb' },
  {
    key: 'freelance',
    kind: 'income',
    name: 'Freelance & business',
    icon: 'laptop',
    color: '#0e7490',
  },
  { key: 'interest', kind: 'income', name: 'Interest', icon: 'percent', color: '#15803d' },
  { key: 'dividend', kind: 'income', name: 'Dividends', icon: 'coins', color: '#a16207' },
  {
    key: 'rent_received',
    kind: 'income',
    name: 'Rent received',
    icon: 'building',
    color: '#4338ca',
  },
  {
    key: 'refund',
    kind: 'income',
    name: 'Refunds & cashback',
    icon: 'rotate-ccw',
    color: '#0f766e',
  },
  { key: 'other_income', kind: 'income', name: 'Other income', icon: 'circle', color: '#6b7280' },
]

/** Section limits in paise (old tax regime). */
export const TAX_LIMITS = {
  '80C': 150_000_00,
  '80CCD1B': 50_000_00,
  '80D_below60': 25_000_00,
  '80D_senior': 50_000_00,
} as const

export const PARENT_COVER = ['none', 'below60', 'senior'] as const
export type ParentCover = (typeof PARENT_COVER)[number]
