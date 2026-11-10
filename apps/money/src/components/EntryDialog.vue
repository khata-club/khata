<script setup lang="ts">
import { KButton, KDialog, KSegmentedControl, KTextField } from '@khata/ui'
import { computed, reactive, ref, watch } from 'vue'

import {
  DEFAULT_MODE,
  PAYMENT_MODE_LABEL,
  PAYMENT_MODES,
  TAX_SECTION_LABEL,
  TAX_SECTIONS,
  type PaymentMode,
  type TaxSection,
  type TxnType,
} from '#shared/constants'
import { todayIST } from '#shared/dates'
import type { Transaction } from '#shared/types'
import { entryDialog } from '@/composables/useEntryDialog'
import { api, ApiError, fieldErrors } from '@/lib/api'
import { track } from '@/lib/analytics'
import { useLookups, useMutate } from '@/lib/queries'

import AmountField from './AmountField.vue'
import SelectField from './SelectField.vue'

const { accounts, categories, accountById, categoryById } = useLookups()

const blank = () => ({
  type: 'expense' as TxnType,
  amount: null as number | null,
  occurredOn: todayIST(),
  accountId: '',
  toAccountId: '',
  categoryId: '',
  paymentMode: '' as PaymentMode | '',
  payee: '',
  note: '',
  taxSection: '' as TaxSection | '',
})
const form = reactive(blank())
const errors = ref<Record<string, string>>({})
const formError = ref('')

const activeAccounts = computed(() => (accounts.data.value ?? []).filter((a) => !a.archived))

watch(
  () => entryDialog.open,
  (open) => {
    if (!open) return
    errors.value = {}
    formError.value = ''
    const e = entryDialog.editing
    Object.assign(form, blank(), { type: entryDialog.presetType })
    if (e) {
      Object.assign(form, {
        type: e.type,
        amount: e.amount,
        occurredOn: e.occurredOn,
        accountId: e.accountId,
        toAccountId: e.toAccountId ?? '',
        categoryId: e.categoryId ?? '',
        paymentMode: e.paymentMode ?? '',
        payee: e.payee ?? '',
        note: e.note ?? '',
        taxSection: e.taxSection ?? '',
      })
    } else {
      form.accountId =
        (activeAccounts.value.find((a) => a.type !== 'credit_card') ?? activeAccounts.value[0])
          ?.id ?? ''
    }
  },
)

// Default the payment mode from the account type (UPI for savings, card for credit cards…).
watch(
  () => form.accountId,
  (id) => {
    const a = accountById.value.get(id)
    if (a && !entryDialog.editing) form.paymentMode = DEFAULT_MODE[a.type]
  },
)

const typeOptions = [
  { value: 'expense', label: 'Expense' },
  { value: 'income', label: 'Income' },
  { value: 'transfer', label: 'Transfer' },
]
const accountOptions = computed(() =>
  activeAccounts.value.map((a) => ({ value: a.id, label: a.name })),
)
const categoryOptions = computed(() =>
  (categories.data.value ?? [])
    .filter((c) => c.kind === (form.type === 'income' ? 'income' : 'expense'))
    .map((c) => ({ value: c.id, label: c.name })),
)
const modeOptions = PAYMENT_MODES.map((m) => ({ value: m, label: PAYMENT_MODE_LABEL[m] }))
const taxOptions = [
  { value: 'none', label: 'Not tax-saving' },
  ...TAX_SECTIONS.map((s) => ({ value: s, label: TAX_SECTION_LABEL[s] })),
]
const taxValue = computed({
  get: () => form.taxSection || 'none',
  set: (v: string) => (form.taxSection = v === 'none' ? '' : (v as TaxSection)),
})

watch(
  () => form.type,
  () => {
    if (form.categoryId && !categoryOptions.value.some((o) => o.value === form.categoryId))
      form.categoryId = ''
  },
)

const save = useMutate(
  (body: object) =>
    entryDialog.editing
      ? api.put<Transaction>(`/transactions/${entryDialog.editing.id}`, body)
      : api.post<Transaction>('/transactions', body),
  ['transactions', 'accounts', 'reports', 'budgets'],
  (t) => {
    if (entryDialog.editing) track('transaction_edit', { txn_type: t.type })
    else
      track('transaction_add', {
        txn_type: t.type,
        category: t.categoryId
          ? (categoryById.value.get(t.categoryId)?.name ?? 'unknown')
          : 'transfer',
        payment_mode: t.paymentMode ?? 'none',
        source: entryDialog.source,
      })
    entryDialog.open = false
  },
)
const remove = useMutate(
  (t: Transaction) => api.del(`/transactions/${t.id}`),
  ['transactions', 'accounts', 'reports', 'budgets'],
  (_r, t) => {
    track('transaction_delete', { txn_type: t.type })
    entryDialog.open = false
  },
)

function submit() {
  errors.value = {}
  formError.value = ''
  if (!form.amount) errors.value.amount = 'Enter an amount'
  if (!form.accountId) errors.value.accountId = 'Pick an account'
  if (Object.keys(errors.value).length) return
  const transfer = form.type === 'transfer'
  save.mutate(
    {
      type: form.type,
      amount: form.amount,
      occurredOn: form.occurredOn,
      accountId: form.accountId,
      toAccountId: transfer ? form.toAccountId || null : null,
      categoryId: transfer ? null : form.categoryId || null,
      paymentMode: form.paymentMode || null,
      payee: form.payee,
      note: form.note,
      taxSection: form.type === 'income' ? null : form.taxSection || null,
    },
    {
      onError: (err) => {
        errors.value = fieldErrors(err)
        formError.value = err instanceof ApiError && !err.issues.length ? err.message : ''
      },
    },
  )
}
</script>

<template>
  <KDialog
    v-model:open="entryDialog.open"
    :title="entryDialog.editing ? 'Edit entry' : 'Add entry'"
    class="max-h-[calc(100dvh-32px)] max-w-[560px] overflow-y-auto p-6 sm:p-8"
  >
    <p v-if="!activeAccounts.length" class="m-0 text-fg-muted">
      Add an account first so entries have somewhere to go.
      <RouterLink
        :to="{ name: 'accounts' }"
        class="font-semibold text-primary"
        @click="entryDialog.open = false"
        >Add an account</RouterLink
      >
    </p>
    <form v-else id="entry-form" class="flex flex-col gap-4" novalidate @submit.prevent="submit">
      <KSegmentedControl v-model="form.type" :options="typeOptions" label="Entry type" />
      <div class="grid gap-4 sm:grid-cols-2">
        <AmountField v-model="form.amount" label="Amount" required :error="errors.amount" />
        <KTextField
          v-model="form.occurredOn"
          label="Date"
          type="date"
          required
          :message="errors.occurredOn"
          :status="errors.occurredOn ? 'error' : 'default'"
        />
      </div>
      <div class="grid gap-4 sm:grid-cols-2">
        <SelectField
          v-model="form.accountId"
          :label="
            form.type === 'transfer'
              ? 'From account'
              : form.type === 'income'
                ? 'Into account'
                : 'Paid from'
          "
          :options="accountOptions"
          :error="errors.accountId"
          required
        />
        <SelectField
          v-if="form.type === 'transfer'"
          v-model="form.toAccountId"
          label="To account"
          :options="accountOptions.filter((o) => o.value !== form.accountId)"
          :error="errors.toAccountId"
          hint="Paying a credit card bill? Transfer to the card."
          required
        />
        <SelectField
          v-else
          v-model="form.categoryId"
          label="Category"
          :options="categoryOptions"
          :error="errors.categoryId"
          required
        />
      </div>
      <div class="grid gap-4 sm:grid-cols-2">
        <SelectField
          v-model="form.paymentMode"
          label="Payment mode"
          :options="modeOptions"
          optional
        />
        <KTextField
          v-model="form.payee"
          :label="form.type === 'income' ? 'From' : 'Paid to'"
          optional
          placeholder="e.g. DMart, Swiggy, landlord"
          maxlength="80"
        />
      </div>
      <KTextField v-model="form.note" label="Note" optional maxlength="280" />
      <SelectField
        v-if="form.type !== 'income'"
        v-model="taxValue"
        label="Tax-saving section"
        :options="taxOptions"
        hint="Tag PPF, ELSS, LIC, tuition fees or health insurance to track 80C/80D."
        optional
      />
      <p v-if="formError" role="alert" class="m-0 text-sm text-danger">{{ formError }}</p>
    </form>
    <template v-if="activeAccounts.length" #footer>
      <KButton
        v-if="entryDialog.editing"
        variant="ghost"
        class="mr-auto text-danger"
        :loading="remove.isPending.value"
        @click="remove.mutate(entryDialog.editing!)"
        >Delete</KButton
      >
      <KButton variant="secondary" @click="entryDialog.open = false">Cancel</KButton>
      <KButton type="submit" form="entry-form" :loading="save.isPending.value">
        {{ entryDialog.editing ? 'Save changes' : 'Add entry' }}
      </KButton>
    </template>
  </KDialog>
</template>
