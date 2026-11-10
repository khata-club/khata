import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import { computed, toValue, type MaybeRefOrGetter } from 'vue'

import type {
  Account,
  Budget,
  Category,
  Goal,
  Holding,
  Me,
  MonthSummary,
  NetWorth,
  Recurring,
  TaxReport,
  TransactionPage,
  TrendPoint,
} from '#shared/types'

import { api, qs } from './api'

/** Every query key starts with one of these, so a mutation can refresh what it touched. */
export type Resource =
  | 'me'
  | 'accounts'
  | 'categories'
  | 'transactions'
  | 'budgets'
  | 'recurring'
  | 'goals'
  | 'holdings'
  | 'reports'

export const useMe = () =>
  useQuery({ queryKey: ['me'], queryFn: () => api.get<Me>('/me'), staleTime: 60_000 })
export const useAccounts = () =>
  useQuery({ queryKey: ['accounts'], queryFn: () => api.get<Account[]>('/accounts') })
export const useCategories = () =>
  useQuery({
    queryKey: ['categories'],
    queryFn: () => api.get<Category[]>('/categories'),
    staleTime: 5 * 60_000,
  })
export const useRecurring = () =>
  useQuery({ queryKey: ['recurring'], queryFn: () => api.get<Recurring[]>('/recurring') })
export const useGoals = () =>
  useQuery({ queryKey: ['goals'], queryFn: () => api.get<Goal[]>('/goals') })
export const useHoldings = () =>
  useQuery({ queryKey: ['holdings'], queryFn: () => api.get<Holding[]>('/holdings') })

export const useBudgets = (month: MaybeRefOrGetter<string>) =>
  useQuery({
    queryKey: ['budgets', computed(() => toValue(month))],
    queryFn: () => api.get<Budget[]>(`/budgets${qs({ month: toValue(month) })}`),
  })

export const useSummary = (month: MaybeRefOrGetter<string>) =>
  useQuery({
    queryKey: ['reports', 'summary', computed(() => toValue(month))],
    queryFn: () => api.get<MonthSummary>(`/reports/summary${qs({ month: toValue(month) })}`),
  })

export const useTrend = (end: MaybeRefOrGetter<string>, months = 6) =>
  useQuery({
    queryKey: ['reports', 'trend', computed(() => toValue(end)), months],
    queryFn: () => api.get<TrendPoint[]>(`/reports/trend${qs({ end: toValue(end), months })}`),
  })

export const useNetWorth = () =>
  useQuery({
    queryKey: ['reports', 'networth'],
    queryFn: () => api.get<NetWorth>('/reports/networth'),
  })

export const useTax = (fy: MaybeRefOrGetter<string>) =>
  useQuery({
    queryKey: ['reports', 'tax', computed(() => toValue(fy))],
    queryFn: () => api.get<TaxReport>(`/reports/tax${qs({ fy: toValue(fy) })}`),
  })

export interface TxnFilters {
  month?: string
  accountId?: string
  categoryId?: string
  type?: string
  paymentMode?: string
  q?: string
}

export const useTransactions = (filters: MaybeRefOrGetter<TxnFilters>) =>
  useInfiniteQuery({
    queryKey: ['transactions', computed(() => ({ ...toValue(filters) }))],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) =>
      api.get<TransactionPage>(
        `/transactions${qs({ ...toValue(filters), cursor: pageParam, limit: 50 })}`,
      ),
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  })

/** Mutation that refreshes the listed resources when it succeeds. */
export function useMutate<TVars, TResult>(
  fn: (vars: TVars) => Promise<TResult>,
  touches: Resource[],
  onSuccess?: (result: TResult, vars: TVars) => void,
) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSuccess: async (result, vars) => {
      await Promise.all(touches.map((r) => qc.invalidateQueries({ queryKey: [r] })))
      onSuccess?.(result, vars)
    },
  })
}

/** Maps for rendering lists: id → account / category. */
export function useLookups() {
  const accounts = useAccounts()
  const categories = useCategories()
  return {
    accounts,
    categories,
    accountById: computed(() => new Map((accounts.data.value ?? []).map((a) => [a.id, a]))),
    categoryById: computed(() => new Map((categories.data.value ?? []).map((c) => [c.id, c]))),
  }
}
