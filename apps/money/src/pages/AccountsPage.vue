<script setup lang="ts">
import { KBadge, KButton, KCreditCard, KStat } from '@khata/ui'
import { Banknote, Building2, CreditCard, Plus, Smartphone, Wallet } from '@lucide/vue'
import { computed, ref, watch } from 'vue'

import { ACCOUNT_TYPE_LABEL, isLiability, type AccountType } from '#shared/constants'
import { formatINR } from '#shared/money'
import type { Account } from '#shared/types'
import AccountDialog from '@/components/AccountDialog.vue'
import EmptyState from '@/components/EmptyState.vue'
import PageHeader from '@/components/PageHeader.vue'
import { useAccounts } from '@/lib/queries'

const accounts = useAccounts()
const open = ref(false)
const editing = ref<Account | null>(null)
watch(open, (o) => !o && (editing.value = null))

function edit(a: Account | null) {
  editing.value = a
  open.value = true
}

const ICON: Record<AccountType, typeof Wallet> = {
  savings: Building2,
  current: Building2,
  cash: Banknote,
  wallet: Smartphone,
  credit_card: CreditCard,
}

const active = computed(() => (accounts.data.value ?? []).filter((a) => !a.archived))
const archived = computed(() => (accounts.data.value ?? []).filter((a) => a.archived))
const cards = computed(() => active.value.filter((a) => isLiability(a.type)))
const others = computed(() => active.value.filter((a) => !isLiability(a.type)))
const totals = computed(() => ({
  money: others.value.reduce((s, a) => s + a.balance, 0),
  owed: cards.value.reduce((s, a) => s + Math.max(0, -a.balance), 0),
}))
const utilisation = (a: Account) =>
  a.creditLimit ? Math.round((Math.max(0, -a.balance) / a.creditLimit) * 100) : null
</script>

<template>
  <PageHeader title="Accounts" subtitle="Balances update from your entries and transfers.">
    <template #actions>
      <KButton class="gap-2" @click="edit(null)"
        ><Plus :size="18" aria-hidden="true" />Add account</KButton
      >
    </template>
  </PageHeader>

  <EmptyState
    v-if="accounts.data.value && !accounts.data.value.length"
    :icon="Wallet"
    title="No accounts yet"
    body="Add your bank account, cash, UPI wallet or credit card."
  >
    <KButton @click="edit(null)">Add account</KButton>
  </EmptyState>

  <template v-else>
    <section
      class="grid grid-cols-2 gap-4 rounded-xl border border-line bg-surface p-6 shadow-raised"
    >
      <KStat label="Bank, cash & wallets" :value="formatINR(totals.money)" />
      <KStat
        label="Card dues"
        :value="formatINR(totals.owed)"
        :value-class="totals.owed ? 'text-danger' : undefined"
      />
    </section>

    <section v-if="others.length" class="flex flex-col gap-3">
      <h2 class="m-0 text-sm font-semibold tracking-label text-fg-muted uppercase">
        Bank, cash & wallets
      </h2>
      <ul
        class="m-0 grid list-none grid-cols-[repeat(auto-fill,minmax(min(100%,280px),1fr))] gap-4 p-0"
      >
        <li v-for="a in others" :key="a.id">
          <button
            type="button"
            class="flex w-full cursor-pointer flex-col gap-4 rounded-xl border border-line bg-surface p-5 text-left shadow-raised transition-transform duration-(--duration-normal) hover:-translate-y-0.5"
            @click="edit(a)"
          >
            <span class="flex items-center gap-3">
              <span
                class="grid size-10 place-items-center rounded-full bg-primary-subtle text-primary"
              >
                <component :is="ICON[a.type]" :size="20" aria-hidden="true" />
              </span>
              <span class="flex min-w-0 flex-col">
                <span class="truncate font-semibold">{{ a.name }}</span>
                <span class="truncate text-xs text-fg-muted">{{
                  a.institution || ACCOUNT_TYPE_LABEL[a.type]
                }}</span>
              </span>
            </span>
            <span
              class="font-mono text-2xl font-semibold tabular-nums"
              :class="a.balance < 0 && 'text-danger'"
              >{{ formatINR(a.balance) }}</span
            >
          </button>
        </li>
      </ul>
    </section>

    <section v-if="cards.length" class="flex flex-col gap-3">
      <h2 class="m-0 text-sm font-semibold tracking-label text-fg-muted uppercase">Credit cards</h2>
      <ul
        class="m-0 grid list-none grid-cols-[repeat(auto-fill,minmax(min(100%,320px),1fr))] gap-6 p-0"
      >
        <li v-for="a in cards" :key="a.id" class="flex flex-col gap-3">
          <button
            type="button"
            class="cursor-pointer border-0 bg-transparent p-0 text-left"
            :aria-label="`Edit ${a.name}`"
            @click="edit(a)"
          >
            <KCreditCard
              :color="a.color ?? '#1F3A5A'"
              :bank-name="a.institution || a.name"
              :tagline="a.institution ? a.name : 'Credit card'"
              holder=""
              :number="`•••• •••• •••• ${a.last4 ?? '••••'}`"
              :expiry="a.dueDay ? `Due ${a.dueDay}` : ''"
              expiry-label=""
              network=""
              tier=""
            />
          </button>
          <div class="flex flex-wrap items-center gap-3 px-1">
            <span class="font-mono font-semibold tabular-nums"
              >{{ formatINR(Math.max(0, -a.balance)) }} owed</span
            >
            <KBadge
              v-if="utilisation(a) != null"
              :tone="utilisation(a)! > 30 ? 'warning' : 'success'"
              >{{ utilisation(a) }}% used</KBadge
            >
            <span v-if="a.balance > 0" class="text-xs text-success"
              >{{ formatINR(a.balance) }} credit</span
            >
          </div>
        </li>
      </ul>
    </section>

    <section v-if="archived.length" class="flex flex-col gap-2">
      <h2 class="m-0 text-sm font-semibold tracking-label text-fg-muted uppercase">Archived</h2>
      <ul class="m-0 flex list-none flex-wrap gap-2 p-0">
        <li v-for="a in archived" :key="a.id">
          <KButton size="sm" variant="outline" @click="edit(a)"
            >{{ a.name }} · {{ formatINR(a.balance) }}</KButton
          >
        </li>
      </ul>
    </section>
  </template>

  <AccountDialog v-model:open="open" :editing="editing" />
</template>
