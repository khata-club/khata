<script setup lang="ts">
import { KButton, KCheckbox, KProgress, KTextField } from '@khata/ui'
import { Check } from '@lucide/vue'
import { useQueryClient } from '@tanstack/vue-query'
import { computed, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'

import { ACCOUNT_TYPE_LABEL, type AccountType } from '#shared/constants'
import type { Me } from '#shared/types'
import AmountField from '@/components/AmountField.vue'
import { api } from '@/lib/api'
import { track } from '@/lib/analytics'
import { useMe } from '@/lib/queries'
import { bucket } from '#shared/plan'

const router = useRouter()
const qc = useQueryClient()
const me = useMe()

const step = ref(1)
const steps = ['About you', 'Your accounts', 'Ready']
const income = ref<number | null>(null)

interface Draft {
  on: boolean
  type: AccountType
  name: string
  balance: number | null
}
const drafts = reactive<Draft[]>([
  { on: true, type: 'savings', name: 'Savings account', balance: null },
  { on: true, type: 'cash', name: 'Cash in hand', balance: null },
  { on: false, type: 'wallet', name: 'UPI wallet', balance: null },
  { on: false, type: 'credit_card', name: 'Credit card', balance: null },
])
const busy = ref(false)
const error = ref('')

const firstName = computed(() => me.data.value?.user.name.split(' ')[0] ?? 'there')

function next() {
  track('onboarding_step', { step: step.value, step_name: steps[step.value - 1]! })
  step.value++
}

async function finish() {
  busy.value = true
  error.value = ''
  try {
    const chosen = drafts.filter((d) => d.on && d.name.trim())
    for (const d of chosen) {
      const bal = d.balance ?? 0
      await api.post('/accounts', {
        type: d.type,
        name: d.name.trim(),
        openingBalance: d.type === 'credit_card' ? -bal : bal,
      })
      track('account_create', { account_type: d.type })
    }
    const prefs = await api.patch<Me['prefs']>('/me/prefs', {
      onboarded: true,
      monthlyIncome: income.value,
    })
    qc.setQueryData<Me>(['me'], (m) => (m ? { ...m, prefs } : m))
    await qc.invalidateQueries({ queryKey: ['accounts'] })
    track('onboarding_complete', { accounts_bucket: bucket(chosen.length) })
    router.replace({ name: 'dashboard' })
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Could not save'
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div class="mx-auto flex w-full max-w-[640px] flex-col gap-8 py-6">
    <span class="flex items-baseline gap-0.5 text-xl font-bold tracking-[0.04em]">
      khata<span class="font-medium text-primary">.money</span>
    </span>
    <div class="flex flex-col gap-2">
      <span class="font-mono text-xs text-fg-muted"
        >Step {{ step }} of 3 · {{ steps[step - 1] }}</span
      >
      <KProgress :value="(step / 3) * 100" :show-value="false" label="Setup progress" />
    </div>

    <section v-if="step === 1" class="flex flex-col gap-6">
      <div class="flex flex-col gap-2">
        <h1 class="m-0 text-3xl font-bold">Namaste, {{ firstName }} 👋</h1>
        <p class="m-0 text-fg-muted">
          Two quick questions and you're in. Everything here is entered by you — no bank logins, no
          SMS reading.
        </p>
      </div>
      <AmountField
        v-model="income"
        label="Monthly take-home income"
        optional
        hint="Used to show your savings rate. You can skip this."
      />
      <div class="flex justify-end"><KButton @click="next">Continue</KButton></div>
    </section>

    <section v-else-if="step === 2" class="flex flex-col gap-6">
      <div class="flex flex-col gap-2">
        <h1 class="m-0 text-3xl font-bold">Where does your money sit?</h1>
        <p class="m-0 text-fg-muted">
          Pick the accounts you use. Balances are optional — add them now or later.
        </p>
      </div>
      <ul class="m-0 flex list-none flex-col gap-3 p-0">
        <li
          v-for="d in drafts"
          :key="d.type"
          class="flex flex-col gap-4 rounded-xl border border-line bg-surface p-5"
          :class="d.on && 'border-primary-soft'"
        >
          <KCheckbox v-model="d.on">{{ ACCOUNT_TYPE_LABEL[d.type] }}</KCheckbox>
          <div v-if="d.on" class="grid gap-4 sm:grid-cols-2">
            <KTextField
              v-model="d.name"
              label="Name"
              placeholder="e.g. HDFC Savings"
              maxlength="80"
            />
            <AmountField
              v-model="d.balance"
              :label="d.type === 'credit_card' ? 'Amount owed today' : 'Balance today'"
              optional
            />
          </div>
        </li>
      </ul>
      <div class="flex justify-between">
        <KButton variant="secondary" @click="step--">Back</KButton>
        <KButton @click="next">Continue</KButton>
      </div>
    </section>

    <section v-else class="flex flex-col items-start gap-6">
      <span class="grid size-14 place-items-center rounded-full bg-success-subtle text-success">
        <Check :size="28" aria-hidden="true" />
      </span>
      <div class="flex flex-col gap-2">
        <h1 class="m-0 text-3xl font-bold">All set</h1>
        <p class="m-0 text-fg-muted">
          We've added common Indian categories — groceries & kirana, rent, EMI, school fees,
          festivals and more. Rename or add your own any time in Settings.
        </p>
      </div>
      <p v-if="error" role="alert" class="m-0 text-danger">{{ error }}</p>
      <div class="flex w-full justify-between">
        <KButton variant="secondary" @click="step--">Back</KButton>
        <KButton :loading="busy" @click="finish">Go to my overview</KButton>
      </div>
    </section>
  </div>
</template>
