<script setup lang="ts">
import { KButton, KDialog, KSegmentedControl, KTextField } from '@khata/ui'
import { computed, reactive, ref, watch } from 'vue'

import {
  FREQUENCIES,
  FREQUENCY_LABEL,
  PAYMENT_MODE_LABEL,
  PAYMENT_MODES,
  TAX_SECTION_LABEL,
  TAX_SECTIONS,
  type Frequency,
  type RecurringKind,
} from '#shared/constants'
import { addMonthsToDate, todayIST } from '#shared/dates'
import { emi } from '#shared/loans'
import { formatINR } from '#shared/money'
import type { Recurring } from '#shared/types'
import { api, fieldErrors } from '@/lib/api'
import { track } from '@/lib/analytics'
import { useHoldings, useLookups, useMutate } from '@/lib/queries'

import AmountField from './AmountField.vue'
import SelectField from './SelectField.vue'

const open = defineModel<boolean>('open', { default: false })
const { editing = null, presetKind = 'bill' } = defineProps<{
  editing?: Recurring | null
  presetKind?: RecurringKind
}>()

const { accounts, categories } = useLookups()
const holdings = useHoldings()

const blank = () => ({
  kind: presetKind as RecurringKind,
  name: '',
  amount: null as number | null,
  frequency: 'monthly' as Frequency,
  nextDueOn: addMonthsToDate(todayIST(), 0),
  accountId: '',
  categoryId: '',
  paymentMode: 'auto_debit' as string,
  taxSection: 'none',
  holdingId: 'none',
  loanPrincipal: null as number | null,
  loanRatePct: '',
  loanTenureMonths: '',
  paidCount: '0',
})
const form = reactive(blank())
const errors = ref<Record<string, string>>({})

const catByName = (name: string) => categories.data.value?.find((c) => c.name === name)?.id ?? ''
watch(open, (o) => {
  if (!o) return
  errors.value = {}
  Object.assign(form, blank())
  if (editing) {
    Object.assign(form, {
      ...editing,
      categoryId: editing.categoryId ?? '',
      paymentMode: editing.paymentMode ?? 'auto_debit',
      taxSection: editing.taxSection ?? 'none',
      holdingId: editing.holdingId ?? 'none',
      loanRatePct: editing.loanRatePct != null ? String(editing.loanRatePct) : '',
      loanTenureMonths: editing.loanTenureMonths != null ? String(editing.loanTenureMonths) : '',
      paidCount: String(editing.paidCount),
    })
  } else {
    form.accountId =
      accounts.data.value?.find((a) => !a.archived && a.type !== 'credit_card')?.id ?? ''
    applyKindDefaults()
  }
})

function applyKindDefaults() {
  if (editing) return
  form.categoryId =
    form.kind === 'emi'
      ? catByName('Loan EMI')
      : form.kind === 'sip'
        ? catByName('Investments & SIPs')
        : form.categoryId
  if (form.kind === 'sip' && form.taxSection === 'none') form.taxSection = 'none'
}
watch(() => form.kind, applyKindDefaults)

// For EMIs, suggest the instalment from principal, rate and tenure.
const suggestedEmi = computed(() => {
  const r = Number(form.loanRatePct)
  const n = Number(form.loanTenureMonths)
  return form.kind === 'emi' && form.loanPrincipal && n > 0 && r >= 0
    ? emi(form.loanPrincipal, r, n)
    : null
})
watch(suggestedEmi, (v) => {
  if (v && !editing) form.amount = v
})

const kindOptions = [
  { value: 'bill', label: 'Bill' },
  { value: 'sip', label: 'SIP' },
  { value: 'emi', label: 'EMI' },
]
const accountOptions = computed(() =>
  (accounts.data.value ?? [])
    .filter((a) => !a.archived)
    .map((a) => ({ value: a.id, label: a.name })),
)
const categoryOptions = computed(() =>
  (categories.data.value ?? [])
    .filter((c) => c.kind === 'expense')
    .map((c) => ({ value: c.id, label: c.name })),
)
const freqOptions = FREQUENCIES.map((f) => ({ value: f, label: FREQUENCY_LABEL[f] }))
const modeOptions = PAYMENT_MODES.map((m) => ({ value: m, label: PAYMENT_MODE_LABEL[m] }))
const taxOptions = [
  { value: 'none', label: 'Not tax-saving' },
  ...TAX_SECTIONS.map((s) => ({ value: s, label: TAX_SECTION_LABEL[s] })),
]
const holdingOptions = computed(() => [
  { value: 'none', label: 'Don’t link' },
  ...(holdings.data.value ?? []).map((h) => ({ value: h.id, label: h.name })),
])

const save = useMutate(
  (body: object) =>
    editing
      ? api.put<Recurring>(`/recurring/${editing.id}`, body)
      : api.post<Recurring>('/recurring', body),
  ['recurring', 'reports'],
  (r) => {
    if (!editing) track('recurring_create', { kind: r.kind })
    open.value = false
  },
)
const remove = useMutate(
  () => api.del(`/recurring/${editing!.id}`),
  ['recurring', 'reports'],
  () => (open.value = false),
)

function submit() {
  errors.value = {}
  if (!form.amount) errors.value.amount = 'Enter an amount'
  if (!form.accountId) errors.value.accountId = 'Pick an account'
  if (Object.keys(errors.value).length) return
  const isEmi = form.kind === 'emi'
  save.mutate(
    {
      kind: form.kind,
      name: form.name,
      amount: form.amount,
      frequency: isEmi ? 'monthly' : form.frequency,
      nextDueOn: form.nextDueOn,
      accountId: form.accountId,
      categoryId: form.categoryId || null,
      paymentMode: form.paymentMode || null,
      taxSection: form.taxSection === 'none' ? null : form.taxSection,
      holdingId: form.kind === 'sip' && form.holdingId !== 'none' ? form.holdingId : null,
      loanPrincipal: isEmi ? form.loanPrincipal : null,
      loanRatePct: isEmi && form.loanRatePct !== '' ? Number(form.loanRatePct) : null,
      loanTenureMonths: isEmi && form.loanTenureMonths ? Number(form.loanTenureMonths) : null,
      paidCount: Number(form.paidCount) || 0,
      active: editing?.active ?? true,
    },
    { onError: (e) => (errors.value = { ...fieldErrors(e), form: e.message }) },
  )
}
</script>

<template>
  <KDialog
    v-model:open="open"
    :title="editing ? `Edit ${editing.name}` : 'Add a bill, SIP or EMI'"
    class="max-h-[calc(100dvh-32px)] max-w-[560px] overflow-y-auto p-6 sm:p-8"
  >
    <form id="recurring-form" class="flex flex-col gap-4" novalidate @submit.prevent="submit">
      <KSegmentedControl v-if="!editing" v-model="form.kind" :options="kindOptions" label="Kind" />
      <KTextField
        v-model="form.name"
        label="Name"
        required
        maxlength="80"
        :placeholder="
          form.kind === 'emi'
            ? 'e.g. Home loan – SBI'
            : form.kind === 'sip'
              ? 'e.g. Parag Parikh Flexi Cap'
              : 'e.g. Rent, BESCOM, Airtel postpaid'
        "
        :status="errors.name ? 'error' : 'default'"
        :message="errors.name"
      />
      <template v-if="form.kind === 'emi'">
        <div class="grid gap-4 sm:grid-cols-3">
          <AmountField
            v-model="form.loanPrincipal"
            label="Loan amount"
            required
            :error="errors.loanPrincipal"
          />
          <KTextField
            v-model="form.loanRatePct"
            label="Interest % p.a."
            type="number"
            step="0.01"
            min="0"
            required
          />
          <KTextField
            v-model="form.loanTenureMonths"
            label="Tenure (months)"
            type="number"
            min="1"
            required
          />
        </div>
        <KTextField
          v-model="form.paidCount"
          label="EMIs already paid"
          type="number"
          min="0"
          hint="So the outstanding amount starts right."
        />
      </template>
      <div class="grid gap-4 sm:grid-cols-2">
        <AmountField
          v-model="form.amount"
          :label="form.kind === 'emi' ? 'EMI amount' : 'Amount'"
          required
          :error="errors.amount"
          :hint="suggestedEmi ? `Calculated EMI: ${formatINR(suggestedEmi)}` : undefined"
        />
        <KTextField v-model="form.nextDueOn" label="Next due date" type="date" required />
      </div>
      <div class="grid gap-4 sm:grid-cols-2">
        <SelectField
          v-if="form.kind !== 'emi'"
          v-model="form.frequency"
          label="Repeats"
          :options="freqOptions"
        />
        <SelectField
          v-model="form.accountId"
          label="Paid from"
          :options="accountOptions"
          :error="errors.accountId"
          required
        />
        <SelectField
          v-model="form.categoryId"
          label="Category"
          :options="categoryOptions"
          optional
        />
        <SelectField
          v-model="form.paymentMode"
          label="Payment mode"
          :options="modeOptions"
          optional
        />
      </div>
      <SelectField
        v-if="form.kind === 'sip'"
        v-model="form.holdingId"
        label="Add to holding"
        :options="holdingOptions"
        hint="Each payment adds to this holding's value in Net worth."
        optional
      />
      <SelectField
        v-model="form.taxSection"
        label="Tax-saving section"
        :options="taxOptions"
        hint="e.g. ELSS SIP or LIC premium → 80C; health insurance → 80D."
        optional
      />
      <p v-if="errors.form" role="alert" class="m-0 text-sm text-danger">{{ errors.form }}</p>
    </form>
    <template #footer>
      <KButton
        v-if="editing"
        variant="ghost"
        class="mr-auto text-danger"
        :loading="remove.isPending.value"
        @click="remove.mutate(undefined)"
        >Delete</KButton
      >
      <KButton variant="secondary" @click="open = false">Cancel</KButton>
      <KButton type="submit" form="recurring-form" :loading="save.isPending.value">{{
        editing ? 'Save' : 'Add'
      }}</KButton>
    </template>
  </KDialog>
</template>
