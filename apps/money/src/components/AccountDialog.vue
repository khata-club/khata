<script setup lang="ts">
import { KButton, KDialog, KSwitchCard, KTextField } from '@khata/ui'
import { computed, reactive, ref, watch } from 'vue'

import { ACCOUNT_TYPE_LABEL, ACCOUNT_TYPES, type AccountType } from '#shared/constants'
import type { Account } from '#shared/types'
import { api, fieldErrors } from '@/lib/api'
import { track } from '@/lib/analytics'
import { useMutate } from '@/lib/queries'

import AmountField from './AmountField.vue'
import SelectField from './SelectField.vue'

const open = defineModel<boolean>('open', { default: false })
const { editing = null } = defineProps<{ editing?: Account | null }>()

const blank = () => ({
  type: 'savings' as AccountType,
  name: '',
  institution: '',
  opening: null as number | null,
  creditLimit: null as number | null,
  dueDay: '',
  last4: '',
  color: '#1F3A5A',
  archived: false,
})
const form = reactive(blank())
const errors = ref<Record<string, string>>({})

watch(open, (o) => {
  if (!o) return
  errors.value = {}
  Object.assign(form, blank())
  if (editing)
    Object.assign(form, {
      type: editing.type,
      name: editing.name,
      institution: editing.institution ?? '',
      opening: Math.abs(editing.openingBalance),
      creditLimit: editing.creditLimit,
      dueDay: editing.dueDay ? String(editing.dueDay) : '',
      last4: editing.last4 ?? '',
      color: editing.color ?? '#1F3A5A',
      archived: editing.archived,
    })
})

const isCard = computed(() => form.type === 'credit_card')
const typeOptions = ACCOUNT_TYPES.map((t) => ({ value: t, label: ACCOUNT_TYPE_LABEL[t] }))

const save = useMutate(
  (body: object) =>
    editing
      ? api.patch<Account>(`/accounts/${editing.id}`, body)
      : api.post<Account>('/accounts', body),
  ['accounts', 'reports'],
  (a) => {
    if (!editing) track('account_create', { account_type: a.type })
    else if (a.archived && !editing.archived) track('account_archive', { account_type: a.type })
    open.value = false
  },
)
const remove = useMutate(
  () => api.del(`/accounts/${editing!.id}`),
  ['accounts', 'transactions', 'reports', 'recurring'],
  () => (open.value = false),
)
const confirmDelete = ref(false)

function submit() {
  errors.value = {}
  const opening = form.opening ?? 0
  save.mutate(
    {
      type: form.type,
      name: form.name,
      institution: form.institution,
      openingBalance: isCard.value ? -opening : opening,
      creditLimit: isCard.value ? form.creditLimit : null,
      dueDay: isCard.value && form.dueDay ? Number(form.dueDay) : null,
      last4: isCard.value && form.last4 ? form.last4 : null,
      color: isCard.value ? form.color : null,
      archived: form.archived,
    },
    { onError: (e) => (errors.value = { ...fieldErrors(e), form: e.message }) },
  )
}
</script>

<template>
  <KDialog
    v-model:open="open"
    :title="editing ? 'Edit account' : 'Add account'"
    class="max-h-[calc(100dvh-32px)] max-w-[520px] overflow-y-auto"
  >
    <form id="account-form" class="flex flex-col gap-4" novalidate @submit.prevent="submit">
      <SelectField v-model="form.type" label="Type" :options="typeOptions" required />
      <KTextField
        v-model="form.name"
        label="Name"
        required
        placeholder="e.g. HDFC Savings, Paytm wallet"
        maxlength="80"
        :status="errors.name ? 'error' : 'default'"
        :message="errors.name"
      />
      <KTextField v-model="form.institution" label="Bank or provider" optional maxlength="60" />
      <AmountField
        v-model="form.opening"
        :label="isCard ? 'Amount owed when you started' : 'Opening balance'"
        hint="The balance before your first entry in khata."
        optional
      />
      <template v-if="isCard">
        <div class="grid gap-4 sm:grid-cols-2">
          <AmountField v-model="form.creditLimit" label="Credit limit" optional />
          <KTextField
            v-model="form.dueDay"
            label="Payment due day"
            type="number"
            min="1"
            max="31"
            optional
            hint="Day of month"
          />
        </div>
        <div class="grid gap-4 sm:grid-cols-2">
          <KTextField
            v-model="form.last4"
            label="Last 4 digits"
            inputmode="numeric"
            maxlength="4"
            optional
            mono
            hint="Only for recognising the card"
          />
          <label class="flex flex-col gap-2 text-sm font-semibold">
            Card colour
            <input
              v-model="form.color"
              type="color"
              class="h-[52px] w-full cursor-pointer rounded-md border border-line bg-surface p-1"
            />
          </label>
        </div>
      </template>
      <KSwitchCard
        v-if="editing"
        v-model="form.archived"
        title="Archived"
        description="Hide from pickers and net worth; history is kept."
      />
      <p v-if="errors.form" role="alert" class="m-0 text-sm text-danger">{{ errors.form }}</p>
    </form>
    <template #footer>
      <template v-if="editing">
        <KButton
          v-if="!confirmDelete"
          variant="ghost"
          class="mr-auto text-danger"
          @click="confirmDelete = true"
          >Delete…</KButton
        >
        <KButton
          v-else
          variant="danger"
          class="mr-auto"
          :loading="remove.isPending.value"
          @click="remove.mutate(undefined)"
          >Delete with all entries</KButton
        >
      </template>
      <KButton variant="secondary" @click="open = false">Cancel</KButton>
      <KButton type="submit" form="account-form" :loading="save.isPending.value">{{
        editing ? 'Save' : 'Add account'
      }}</KButton>
    </template>
  </KDialog>
</template>
