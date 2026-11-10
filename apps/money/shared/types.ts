import type {
  AccountType,
  CategoryKind,
  CategoryIcon,
  Frequency,
  HoldingKind,
  ParentCover,
  PaymentMode,
  RecurringKind,
  TaxSection,
  TxnType,
} from './constants'
import type { TaxSectionProgress } from './tax'

/** API response shapes. All money is integer paise; dates are ISO strings. */

export interface Me {
  user: { id: string; name: string; email: string; image: string | null }
  prefs: Prefs
}

export interface Prefs {
  onboarded: boolean
  analyticsConsent: boolean | null
  monthlyIncome: number | null
  taxSelfSenior: boolean
  taxParents: ParentCover
}

export interface Account {
  id: string
  type: AccountType
  name: string
  institution: string | null
  openingBalance: number
  creditLimit: number | null
  dueDay: number | null
  color: string | null
  last4: string | null
  archived: boolean
  balance: number
}

export interface Category {
  id: string
  kind: CategoryKind
  name: string
  icon: CategoryIcon
  color: string
  isDefault: boolean
}

export interface Transaction {
  id: string
  type: TxnType
  amount: number
  occurredOn: string
  accountId: string
  toAccountId: string | null
  categoryId: string | null
  paymentMode: PaymentMode | null
  payee: string | null
  note: string | null
  taxSection: TaxSection | null
  recurringId: string | null
}

export interface TransactionPage {
  items: Transaction[]
  nextCursor: string | null
}

export interface Budget {
  id: string
  month: string
  categoryId: string
  limit: number
  spent: number
}

export interface Recurring {
  id: string
  kind: RecurringKind
  name: string
  amount: number
  frequency: Frequency
  nextDueOn: string
  accountId: string
  categoryId: string | null
  paymentMode: PaymentMode | null
  taxSection: TaxSection | null
  holdingId: string | null
  loanPrincipal: number | null
  loanRatePct: number | null
  loanTenureMonths: number | null
  paidCount: number
  active: boolean
  /** EMIs only: principal still owed. */
  outstanding: number | null
}

export interface Goal {
  id: string
  name: string
  target: number
  targetDate: string | null
  icon: CategoryIcon
  saved: number
  archived: boolean
  monthlyNeeded: number | null
}

export interface Holding {
  id: string
  kind: HoldingKind
  name: string
  invested: number
  currentValue: number
  asOf: string
  taxSection: TaxSection | null
  maturityOn: string | null
}

export interface TaxDeclaration {
  id: string
  fy: string
  section: TaxSection
  label: string
  amount: number
}

export interface MonthSummary {
  month: string
  income: number
  expense: number
  byCategory: { categoryId: string | null; amount: number }[]
  incomeByCategory: { categoryId: string | null; amount: number }[]
  byPaymentMode: { paymentMode: PaymentMode | null; amount: number }[]
  daily: { day: string; amount: number }[]
}

export interface TrendPoint {
  month: string
  income: number
  expense: number
}

export interface NetWorth {
  assets: number
  liabilities: number
  netWorth: number
  cashAndBank: number
  holdings: number
  cardDues: number
  loans: number
  byHoldingKind: { kind: HoldingKind; value: number }[]
  history: { month: string; assets: number; liabilities: number }[]
}

export interface TaxReport {
  fy: string
  sections: (TaxSectionProgress & {
    fromEntries: number
    fromDeclarations: number
  })[]
  declarations: TaxDeclaration[]
  entries: Transaction[]
}

export interface ImportResult {
  imported: number
  duplicates: number
  createdCategories: number
}
