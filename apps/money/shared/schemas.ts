import { z } from 'zod'

import {
  ACCOUNT_TYPES,
  CATEGORY_ICONS,
  CATEGORY_KINDS,
  FREQUENCIES,
  HOLDING_KINDS,
  PARENT_COVER,
  PAYMENT_MODES,
  RECURRING_KINDS,
  TAX_SECTIONS,
  TXN_TYPES,
} from './constants'
import { isFY } from './dates'

/** Paise: whole number, up to ₹100 crore per value. */
const paise = z.number().int().min(0).max(100_000_000_000_00)
const signedPaise = z.number().int().min(-100_000_000_000_00).max(100_000_000_000_00)
export const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD')
export const month = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Use YYYY-MM')
export const fy = z.string().refine(isFY, 'Use a financial year like 2026-27')
const name = z.string().trim().min(1, 'Required').max(80)
const optText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullish()
    .transform((v) => v || null)
const id = z.string().min(1).max(40)

export const accountInput = z.object({
  type: z.enum(ACCOUNT_TYPES),
  name,
  institution: optText(60),
  /** Signed: liabilities (credit cards) carry a negative opening balance. */
  openingBalance: signedPaise.default(0),
  creditLimit: paise.nullish(),
  dueDay: z.number().int().min(1).max(31).nullish(),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .nullish(),
  last4: z
    .string()
    .regex(/^\d{4}$/)
    .nullish(),
  archived: z.boolean().optional(),
})
export type AccountInput = z.input<typeof accountInput>

export const categoryInput = z.object({
  kind: z.enum(CATEGORY_KINDS),
  name,
  icon: z.enum(CATEGORY_ICONS).default('circle'),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .default('#6b7280'),
})
export type CategoryInput = z.input<typeof categoryInput>

export const transactionInput = z
  .object({
    type: z.enum(TXN_TYPES),
    amount: paise.min(1, 'Enter an amount'),
    occurredOn: isoDate,
    accountId: id,
    toAccountId: id.nullish(),
    categoryId: id.nullish(),
    paymentMode: z.enum(PAYMENT_MODES).nullish(),
    payee: optText(80),
    note: optText(280),
    taxSection: z.enum(TAX_SECTIONS).nullish(),
  })
  .superRefine((t, ctx) => {
    if (t.type === 'transfer') {
      if (!t.toAccountId)
        ctx.addIssue({
          code: 'custom',
          path: ['toAccountId'],
          message: 'Pick the account money goes to',
        })
      else if (t.toAccountId === t.accountId)
        ctx.addIssue({ code: 'custom', path: ['toAccountId'], message: 'Pick a different account' })
    } else if (!t.categoryId) {
      ctx.addIssue({ code: 'custom', path: ['categoryId'], message: 'Pick a category' })
    }
  })
export type TransactionInput = z.input<typeof transactionInput>

export const transactionQuery = z.object({
  month: month.optional(),
  from: isoDate.optional(),
  to: isoDate.optional(),
  accountId: id.optional(),
  categoryId: id.optional(),
  type: z.enum(TXN_TYPES).optional(),
  paymentMode: z.enum(PAYMENT_MODES).optional(),
  q: z.string().trim().max(80).optional(),
  cursor: z.string().max(80).optional(),
  limit: z.coerce.number().int().min(1).max(500).default(50),
})

export const budgetInput = z.object({
  month,
  categoryId: id,
  limit: paise,
})
export const budgetCopyInput = z.object({ from: month, to: month })

export const recurringInput = z
  .object({
    kind: z.enum(RECURRING_KINDS),
    name,
    amount: paise.min(1),
    frequency: z.enum(FREQUENCIES).default('monthly'),
    nextDueOn: isoDate,
    accountId: id,
    categoryId: id.nullish(),
    paymentMode: z.enum(PAYMENT_MODES).nullish(),
    taxSection: z.enum(TAX_SECTIONS).nullish(),
    holdingId: id.nullish(),
    loanPrincipal: paise.nullish(),
    loanRatePct: z.number().min(0).max(60).nullish(),
    loanTenureMonths: z.number().int().min(1).max(480).nullish(),
    paidCount: z.number().int().min(0).default(0),
    active: z.boolean().default(true),
  })
  .superRefine((r, ctx) => {
    if (
      r.kind === 'emi' &&
      (r.loanPrincipal == null || r.loanRatePct == null || r.loanTenureMonths == null)
    )
      ctx.addIssue({
        code: 'custom',
        path: ['loanPrincipal'],
        message: 'EMIs need principal, rate and tenure',
      })
  })
export type RecurringInput = z.input<typeof recurringInput>

export const payRecurringInput = z.object({
  paidOn: isoDate.optional(),
  amount: paise.min(1).optional(),
})

export const goalInput = z.object({
  name,
  target: paise.min(1),
  targetDate: isoDate.nullish(),
  icon: z.enum(CATEGORY_ICONS).default('trending-up'),
  saved: paise.default(0),
  archived: z.boolean().optional(),
})
export const goalContributionInput = z.object({
  amount: signedPaise.refine((v) => v !== 0, 'Enter an amount'),
  on: isoDate.optional(),
  note: optText(140),
})

export const holdingInput = z.object({
  kind: z.enum(HOLDING_KINDS),
  name,
  invested: paise.default(0),
  currentValue: paise,
  asOf: isoDate,
  taxSection: z.enum(TAX_SECTIONS).nullish(),
  maturityOn: isoDate.nullish(),
})

export const taxDeclarationInput = z.object({
  fy,
  section: z.enum(TAX_SECTIONS),
  label: name,
  amount: paise.min(1),
})

export const prefsInput = z.object({
  onboarded: z.boolean().optional(),
  analyticsConsent: z.boolean().nullable().optional(),
  monthlyIncome: paise.nullish(),
  taxSelfSenior: z.boolean().optional(),
  taxParents: z.enum(PARENT_COVER).optional(),
})

export const importRow = z.object({
  occurredOn: isoDate,
  type: z.enum(['expense', 'income']),
  amount: paise.min(1),
  category: z.string().trim().max(80).nullish(),
  payee: optText(80),
  note: optText(280),
  paymentMode: z.enum(PAYMENT_MODES).nullish(),
})
export const importInput = z.object({
  accountId: id,
  rows: z.array(importRow).min(1).max(1000),
})
export type ImportRow = z.input<typeof importRow>
