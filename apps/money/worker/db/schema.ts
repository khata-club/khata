import { sql } from 'drizzle-orm'
import { index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core'

import type {
  AccountType,
  CategoryIcon,
  CategoryKind,
  Frequency,
  HoldingKind,
  ParentCover,
  PaymentMode,
  RecurringKind,
  TaxSection,
  TxnType,
} from '../../shared/constants'

// ---------------------------------------------------------------------------
// Better Auth core tables (user, session, account, verification)
// ---------------------------------------------------------------------------

const ts = (name: string) => integer(name, { mode: 'timestamp_ms' })
const now = sql`(cast(unixepoch('subsecond') * 1000 as integer))`

export const user = sqliteTable('user', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: integer('email_verified', { mode: 'boolean' }).notNull().default(false),
  image: text('image'),
  createdAt: ts('created_at').notNull().default(now),
  updatedAt: ts('updated_at').notNull().default(now),
})

export const session = sqliteTable(
  'session',
  {
    id: text('id').primaryKey(),
    expiresAt: ts('expires_at').notNull(),
    token: text('token').notNull().unique(),
    createdAt: ts('created_at').notNull().default(now),
    updatedAt: ts('updated_at').notNull().default(now),
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
  },
  (t) => [index('session_user_idx').on(t.userId)],
)

export const account = sqliteTable(
  'account',
  {
    id: text('id').primaryKey(),
    accountId: text('account_id').notNull(),
    providerId: text('provider_id').notNull(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    accessToken: text('access_token'),
    refreshToken: text('refresh_token'),
    idToken: text('id_token'),
    accessTokenExpiresAt: ts('access_token_expires_at'),
    refreshTokenExpiresAt: ts('refresh_token_expires_at'),
    scope: text('scope'),
    password: text('password'),
    createdAt: ts('created_at').notNull().default(now),
    updatedAt: ts('updated_at').notNull().default(now),
  },
  (t) => [index('account_user_idx').on(t.userId)],
)

export const verification = sqliteTable(
  'verification',
  {
    id: text('id').primaryKey(),
    identifier: text('identifier').notNull(),
    value: text('value').notNull(),
    expiresAt: ts('expires_at').notNull(),
    createdAt: ts('created_at').notNull().default(now),
    updatedAt: ts('updated_at').notNull().default(now),
  },
  (t) => [index('verification_identifier_idx').on(t.identifier)],
)

export const authSchema = { user, session, account, verification }

// ---------------------------------------------------------------------------
// App tables. Every row belongs to one user (cascade on delete). Money = paise.
// Table names are prefixed `fin_` to stay clear of Better Auth's `account`.
// ---------------------------------------------------------------------------

const owner = () =>
  text('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' })
const stamps = {
  createdAt: ts('created_at').notNull().default(now),
  updatedAt: ts('updated_at').notNull().default(now),
}

export const prefs = sqliteTable('fin_prefs', {
  userId: text('user_id')
    .primaryKey()
    .references(() => user.id, { onDelete: 'cascade' }),
  onboarded: integer('onboarded', { mode: 'boolean' }).notNull().default(false),
  analyticsConsent: integer('analytics_consent', { mode: 'boolean' }),
  monthlyIncome: integer('monthly_income'),
  taxSelfSenior: integer('tax_self_senior', { mode: 'boolean' }).notNull().default(false),
  taxParents: text('tax_parents').$type<ParentCover>().notNull().default('none'),
  lastSnapshotMonth: text('last_snapshot_month'),
  ...stamps,
})

export const accounts = sqliteTable(
  'fin_accounts',
  {
    id: text('id').primaryKey(),
    userId: owner(),
    type: text('type').$type<AccountType>().notNull(),
    name: text('name').notNull(),
    institution: text('institution'),
    openingBalance: integer('opening_balance').notNull().default(0),
    creditLimit: integer('credit_limit'),
    dueDay: integer('due_day'),
    color: text('color'),
    last4: text('last4'),
    archived: integer('archived', { mode: 'boolean' }).notNull().default(false),
    ...stamps,
  },
  (t) => [index('fin_accounts_user_idx').on(t.userId)],
)

export const categories = sqliteTable(
  'fin_categories',
  {
    id: text('id').primaryKey(),
    userId: owner(),
    kind: text('kind').$type<CategoryKind>().notNull(),
    name: text('name').notNull(),
    icon: text('icon').$type<CategoryIcon>().notNull().default('circle'),
    color: text('color').notNull().default('#6b7280'),
    isDefault: integer('is_default', { mode: 'boolean' }).notNull().default(false),
    ...stamps,
  },
  (t) => [index('fin_categories_user_idx').on(t.userId)],
)

export const transactions = sqliteTable(
  'fin_transactions',
  {
    id: text('id').primaryKey(),
    userId: owner(),
    type: text('type').$type<TxnType>().notNull(),
    amount: integer('amount').notNull(),
    occurredOn: text('occurred_on').notNull(),
    accountId: text('account_id')
      .notNull()
      .references(() => accounts.id, { onDelete: 'cascade' }),
    toAccountId: text('to_account_id').references(() => accounts.id, { onDelete: 'cascade' }),
    categoryId: text('category_id').references(() => categories.id, { onDelete: 'set null' }),
    paymentMode: text('payment_mode').$type<PaymentMode>(),
    payee: text('payee'),
    note: text('note'),
    taxSection: text('tax_section').$type<TaxSection>(),
    recurringId: text('recurring_id'),
    ...stamps,
  },
  (t) => [
    index('fin_txn_user_date_idx').on(t.userId, t.occurredOn),
    index('fin_txn_user_cat_idx').on(t.userId, t.categoryId),
    index('fin_txn_account_idx').on(t.accountId),
    index('fin_txn_to_account_idx').on(t.toAccountId),
  ],
)

export const budgets = sqliteTable(
  'fin_budgets',
  {
    id: text('id').primaryKey(),
    userId: owner(),
    month: text('month').notNull(),
    categoryId: text('category_id')
      .notNull()
      .references(() => categories.id, { onDelete: 'cascade' }),
    limit: integer('limit_amount').notNull(),
    ...stamps,
  },
  (t) => [uniqueIndex('fin_budgets_unique').on(t.userId, t.month, t.categoryId)],
)

export const holdings = sqliteTable(
  'fin_holdings',
  {
    id: text('id').primaryKey(),
    userId: owner(),
    kind: text('kind').$type<HoldingKind>().notNull(),
    name: text('name').notNull(),
    invested: integer('invested').notNull().default(0),
    currentValue: integer('current_value').notNull(),
    asOf: text('as_of').notNull(),
    taxSection: text('tax_section').$type<TaxSection>(),
    maturityOn: text('maturity_on'),
    ...stamps,
  },
  (t) => [index('fin_holdings_user_idx').on(t.userId)],
)

export const recurring = sqliteTable(
  'fin_recurring',
  {
    id: text('id').primaryKey(),
    userId: owner(),
    kind: text('kind').$type<RecurringKind>().notNull(),
    name: text('name').notNull(),
    amount: integer('amount').notNull(),
    frequency: text('frequency').$type<Frequency>().notNull().default('monthly'),
    nextDueOn: text('next_due_on').notNull(),
    anchorDay: integer('anchor_day').notNull(),
    accountId: text('account_id')
      .notNull()
      .references(() => accounts.id, { onDelete: 'cascade' }),
    categoryId: text('category_id').references(() => categories.id, { onDelete: 'set null' }),
    paymentMode: text('payment_mode').$type<PaymentMode>(),
    taxSection: text('tax_section').$type<TaxSection>(),
    holdingId: text('holding_id').references(() => holdings.id, { onDelete: 'set null' }),
    loanPrincipal: integer('loan_principal'),
    loanRateBps: integer('loan_rate_bps'),
    loanTenureMonths: integer('loan_tenure_months'),
    paidCount: integer('paid_count').notNull().default(0),
    active: integer('active', { mode: 'boolean' }).notNull().default(true),
    ...stamps,
  },
  (t) => [index('fin_recurring_user_due_idx').on(t.userId, t.nextDueOn)],
)

export const goals = sqliteTable(
  'fin_goals',
  {
    id: text('id').primaryKey(),
    userId: owner(),
    name: text('name').notNull(),
    target: integer('target').notNull(),
    targetDate: text('target_date'),
    icon: text('icon').$type<CategoryIcon>().notNull().default('trending-up'),
    saved: integer('saved').notNull().default(0),
    archived: integer('archived', { mode: 'boolean' }).notNull().default(false),
    ...stamps,
  },
  (t) => [index('fin_goals_user_idx').on(t.userId)],
)

export const goalContributions = sqliteTable(
  'fin_goal_contributions',
  {
    id: text('id').primaryKey(),
    userId: owner(),
    goalId: text('goal_id')
      .notNull()
      .references(() => goals.id, { onDelete: 'cascade' }),
    amount: integer('amount').notNull(),
    on: text('on_date').notNull(),
    note: text('note'),
    createdAt: ts('created_at').notNull().default(now),
  },
  (t) => [index('fin_goal_contrib_goal_idx').on(t.goalId)],
)

export const taxDeclarations = sqliteTable(
  'fin_tax_declarations',
  {
    id: text('id').primaryKey(),
    userId: owner(),
    fy: text('fy').notNull(),
    section: text('section').$type<TaxSection>().notNull(),
    label: text('label').notNull(),
    amount: integer('amount').notNull(),
    createdAt: ts('created_at').notNull().default(now),
  },
  (t) => [index('fin_tax_decl_user_fy_idx').on(t.userId, t.fy)],
)

export const netWorthSnapshots = sqliteTable(
  'fin_networth_snapshots',
  {
    userId: owner(),
    month: text('month').notNull(),
    assets: integer('assets').notNull(),
    liabilities: integer('liabilities').notNull(),
  },
  (t) => [uniqueIndex('fin_networth_unique').on(t.userId, t.month)],
)

export const appSchema = {
  prefs,
  accounts,
  categories,
  transactions,
  budgets,
  holdings,
  recurring,
  goals,
  goalContributions,
  taxDeclarations,
  netWorthSnapshots,
}
