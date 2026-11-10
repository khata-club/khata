<script setup lang="ts">
import { KBanner, KButton, KDialog, KSegmentedControl, KSwitchCard, KTextField } from '@khata/ui'
import { Plus, Trash2 } from '@lucide/vue'
import { useQueryClient } from '@tanstack/vue-query'
import { computed, reactive, ref, watch } from 'vue'

import {
  PARENT_COVER,
  TAX_SECTION_LABEL,
  TAX_SECTIONS,
  type ParentCover,
  type TaxSection,
} from '#shared/constants'
import { fyOf, todayIST } from '#shared/dates'
import { formatINR } from '#shared/money'
import type { Me } from '#shared/types'
import AmountField from '@/components/AmountField.vue'
import PageHeader from '@/components/PageHeader.vue'
import SelectField from '@/components/SelectField.vue'
import TransactionList from '@/components/TransactionList.vue'
import { api } from '@/lib/api'
import { track } from '@/lib/analytics'
import { useMe, useMutate, useTax } from '@/lib/queries'

const current = fyOf(todayIST())
const prevFy = (fy: string) => {
  const y = Number(fy.slice(0, 4)) - 1
  return `${y}-${String((y + 1) % 100).padStart(2, '0')}`
}
const fyOptions = [prevFy(current), current].map((f) => ({ value: f, label: `FY ${f}` }))
const fy = ref(current)
const tax = useTax(fy)
watch(fy, (f) => track('tax_view', { fy: f }), { immediate: true })

const me = useMe()
const qc = useQueryClient()
const prefs = computed(() => me.data.value?.prefs)
async function setPref(body: Partial<Me['prefs']>) {
  const p = await api.patch<Me['prefs']>('/me/prefs', body)
  qc.setQueryData<Me>(['me'], (m) => (m ? { ...m, prefs: p } : m))
  qc.invalidateQueries({ queryKey: ['reports', 'tax'] })
}
const selfSenior = computed({
  get: () => prefs.value?.taxSelfSenior ?? false,
  set: (v) => setPref({ taxSelfSenior: v }),
})
const parents = computed({
  get: () => prefs.value?.taxParents ?? 'none',
  set: (v: string) => setPref({ taxParents: v as ParentCover }),
})
const parentOptions = PARENT_COVER.map((p) => ({
  value: p,
  label: {
    none: 'Not covering parents',
    below60: 'Parents below 60',
    senior: 'Senior-citizen parents',
  }[p],
}))

const SHORT: Record<TaxSection, string> = { '80C': '80C', '80D': '80D', '80CCD1B': '80CCD(1B)' }
const HINT: Record<TaxSection, string> = {
  '80C': 'PPF, ELSS, EPF, LIC, NSC, tax-saver FD, Sukanya, tuition fees, home-loan principal',
  '80D': 'Health insurance premiums and preventive check-ups',
  '80CCD1B': 'Your own extra NPS Tier-I contribution, over and above 80C',
}

// Declarations: amounts that never pass through your accounts (EPF via payroll, etc.).
const open = ref(false)
const form = reactive({ section: '80C' as TaxSection, label: '', amount: null as number | null })
const sectionOptions = TAX_SECTIONS.map((s) => ({ value: s, label: TAX_SECTION_LABEL[s] }))
const add = useMutate(
  () =>
    api.post('/reports/tax/declarations', {
      fy: fy.value,
      section: form.section,
      label: form.label,
      amount: form.amount,
    }),
  ['reports'],
  () => {
    track('tax_declaration_add', { section: form.section })
    open.value = false
  },
)
const remove = useMutate((id: string) => api.del(`/reports/tax/declarations/${id}`), ['reports'])
function openAdd(section: TaxSection = '80C') {
  Object.assign(form, {
    section,
    label: section === '80C' ? 'EPF deducted from salary' : '',
    amount: null,
  })
  open.value = true
}
</script>

<template>
  <PageHeader
    title="Tax saver"
    subtitle="Track deductions under the old tax regime through the financial year."
  >
    <template #actions>
      <KSegmentedControl v-model="fy" :options="fyOptions" label="Financial year" size="sm" />
    </template>
  </PageHeader>

  <KBanner tone="primary" title="Old regime only — for planning, not filing">
    These limits apply if you choose the old tax regime. The new regime doesn't allow 80C/80D
    (except employer NPS). Check with your CA or the Income Tax portal before filing.
  </KBanner>

  <div v-if="tax.data.value" class="grid gap-4 md:grid-cols-3">
    <section
      v-for="s in tax.data.value.sections"
      :key="s.section"
      class="flex flex-col gap-3 rounded-xl border border-line bg-surface p-6 shadow-raised"
    >
      <header class="flex items-baseline gap-2">
        <h2 class="m-0 text-lg font-bold">{{ SHORT[s.section] }}</h2>
        <span class="ml-auto font-mono text-xs text-fg-muted">limit {{ formatINR(s.limit) }}</span>
      </header>
      <span class="font-mono text-2xl font-semibold tabular-nums">{{ formatINR(s.used) }}</span>
      <span class="h-2 overflow-hidden rounded-full bg-surface-recessed" aria-hidden="true">
        <span
          class="block h-full rounded-full transition-[width] duration-(--duration-slow)"
          :class="s.pct >= 100 ? 'bg-success' : 'bg-primary'"
          :style="{ width: `${s.pct}%` }"
        />
      </span>
      <span class="text-sm" :class="s.remaining ? 'text-fg-muted' : 'font-semibold text-success'">
        {{ s.remaining ? `${formatINR(s.remaining)} more can still save tax` : 'Limit fully used' }}
      </span>
      <span class="text-xs text-fg-muted">{{ HINT[s.section] }}</span>
      <span class="font-mono text-xs text-fg-muted"
        >Entries {{ formatINR(s.fromEntries) }} · Declared {{ formatINR(s.fromDeclarations) }}</span
      >
      <KButton
        size="sm"
        variant="secondary"
        class="mt-auto gap-1 self-start"
        @click="openAdd(s.section)"
        ><Plus :size="14" aria-hidden="true" />Declare amount</KButton
      >
    </section>
  </div>

  <section class="flex flex-col gap-3">
    <h2 class="m-0 text-sm font-semibold tracking-label text-fg-muted uppercase">80D cover</h2>
    <div class="grid gap-4 md:grid-cols-2">
      <KSwitchCard
        v-model="selfSenior"
        title="I'm a senior citizen (60+)"
        description="Raises your own 80D limit from ₹25,000 to ₹50,000."
      />
      <SelectField v-model="parents" label="Parents' health insurance" :options="parentOptions" />
    </div>
  </section>

  <section
    v-if="tax.data.value?.declarations.length"
    class="flex flex-col gap-2 rounded-xl border border-line bg-surface p-4 shadow-raised sm:p-6"
  >
    <h2 class="m-0 text-sm font-semibold tracking-label uppercase">
      Declared (not from your accounts)
    </h2>
    <ul class="m-0 flex list-none flex-col p-0">
      <li
        v-for="d in tax.data.value.declarations"
        :key="d.id"
        class="flex items-center gap-3 px-2 py-2"
      >
        <span class="font-mono text-xs text-fg-muted">{{ SHORT[d.section] }}</span>
        <span class="min-w-0 flex-1 truncate">{{ d.label }}</span>
        <span class="font-mono text-sm font-semibold">{{ formatINR(d.amount) }}</span>
        <KButton
          variant="ghost"
          size="sm"
          icon-only
          :aria-label="`Remove ${d.label}`"
          @click="remove.mutate(d.id)"
          ><Trash2 :size="16"
        /></KButton>
      </li>
    </ul>
  </section>

  <section
    class="flex flex-col gap-2 rounded-xl border border-line bg-surface p-4 shadow-raised sm:p-6"
  >
    <h2 class="m-0 text-sm font-semibold tracking-label uppercase">Tagged entries this year</h2>
    <TransactionList
      v-if="tax.data.value?.entries.length"
      :items="tax.data.value.entries"
      :group-by-date="false"
    />
    <p v-else class="m-0 text-sm text-fg-muted">
      When you add an entry or SIP, set its “Tax-saving section” — PPF deposits, ELSS SIPs, LIC and
      health premiums, tuition fees — and it counts here.
    </p>
  </section>

  <KDialog v-model:open="open" title="Declare an amount" :description="`FY ${fy}`">
    <form
      id="decl-form"
      class="flex flex-col gap-4"
      @submit.prevent="form.label && form.amount && add.mutate(undefined)"
    >
      <SelectField v-model="form.section" label="Section" :options="sectionOptions" required />
      <KTextField
        v-model="form.label"
        label="What is it?"
        required
        maxlength="80"
        placeholder="e.g. EPF deducted from salary"
      />
      <AmountField v-model="form.amount" label="Amount for the year" required />
    </form>
    <template #footer>
      <KButton variant="secondary" @click="open = false">Cancel</KButton>
      <KButton
        type="submit"
        form="decl-form"
        :disabled="!form.label || !form.amount"
        :loading="add.isPending.value"
        >Add</KButton
      >
    </template>
  </KDialog>
</template>
