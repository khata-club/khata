<script setup lang="ts">
import { Check, HandCoins } from '@lucide/vue'
import { cn, GAvatar, GButton, GSegmentedControl, useReducedMotion } from '@khata/glass'
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'

interface Entry {
  who: string
  initials: string
  tone: 'gray' | 'accent' | 'teal' | 'orange' | 'purple'
  note: string
  /** Positive: you are owed; negative: you owe. */
  amount: number
}

const { animate = true, currency = '₹' } = defineProps<{
  /** Reveal entries one by one; off shows them all at once. */
  animate?: boolean
  currency?: string
}>()

const GROUPS: { name: string; rows: Entry[] }[] = [
  {
    name: 'Goa trip',
    rows: [
      { who: 'Aanya paid', initials: 'AN', tone: 'purple', note: 'Villa, 3 nights', amount: 4200 },
      { who: 'You paid', initials: 'YO', tone: 'accent', note: 'Scooter rental', amount: 1800 },
      { who: 'Kabir paid', initials: 'KB', tone: 'orange', note: 'Seafood dinner', amount: -950 },
      { who: 'You paid', initials: 'YO', tone: 'accent', note: 'Fuel', amount: 600 },
    ],
  },
  {
    name: 'Flat 4B',
    rows: [
      { who: 'Meera paid', initials: 'MR', tone: 'teal', note: 'Electricity, Oct', amount: -820 },
      { who: 'You paid', initials: 'YO', tone: 'accent', note: 'Wi-Fi', amount: 450 },
      { who: 'Rohan paid', initials: 'RH', tone: 'orange', note: 'Groceries', amount: -1240 },
      { who: 'You paid', initials: 'YO', tone: 'accent', note: 'Cleaning', amount: 300 },
    ],
  },
  {
    name: 'Chai fund',
    rows: [
      { who: 'You paid', initials: 'YO', tone: 'accent', note: 'Monday round', amount: 120 },
      { who: 'Dev paid', initials: 'DV', tone: 'teal', note: 'Samosas', amount: -80 },
      { who: 'You paid', initials: 'YO', tone: 'accent', note: 'Thursday round', amount: 140 },
      { who: 'Isha paid', initials: 'IS', tone: 'purple', note: 'Biscuits', amount: -60 },
    ],
  },
]
const OPTIONS = GROUPS.map((g, i) => ({ value: String(i), label: g.name }))

const group = ref(0)
const shown = ref(0)
const settled = ref(false)
const reduced = useReducedMotion()
let timer: ReturnType<typeof setInterval> | undefined

function start() {
  clearInterval(timer)
  if (!animate || reduced.value) {
    shown.value = 4
    return
  }
  shown.value = 0
  timer = setInterval(() => {
    if (shown.value >= 4) clearInterval(timer)
    else shown.value++
  }, 650)
}
onMounted(start)
onBeforeUnmount(() => clearInterval(timer))
watch(() => animate, start)

function select(v: string | undefined) {
  if (v == null) return
  group.value = Number(v)
  settled.value = false
  start()
}

const fmt = (n: number) => currency + Math.abs(n).toLocaleString('en-IN')
const rows = computed(() => GROUPS[group.value]!.rows)
const balance = computed(() =>
  settled.value ? 0 : rows.value.slice(0, shown.value).reduce((a, r) => a + r.amount, 0),
)
</script>

<template>
  <article
    aria-label="Example ledger"
    class="flex min-w-0 flex-col gap-5 rounded-2xl bg-surface p-5 shadow-lift sm:p-6"
  >
    <!-- Picking a group swaps the ledger below in place. -->
    <GSegmentedControl
      :model-value="String(group)"
      :options="OPTIONS"
      label="Ledger group"
      class="w-full"
      @update:model-value="select"
    />

    <div class="flex items-end justify-between gap-4 px-1" aria-live="polite">
      <div class="flex flex-col">
        <span class="text-footnote text-label-secondary">Your balance</span>
        <span
          :class="
            cn(
              'text-[clamp(40px,7vw,56px)] leading-[1.05] font-bold tracking-[-0.03em] tabular-nums transition-colors duration-(--duration-normal)',
              balance > 0 ? 'text-positive' : balance < 0 ? 'text-negative' : 'text-label',
            )
          "
        >
          {{ (balance < 0 ? '−' : '') + fmt(balance) }}
        </span>
      </div>
      <span class="pb-1.5 text-subhead text-label-secondary">{{
        settled ? 'All settled' : balance >= 0 ? 'owed to you' : 'you owe'
      }}</span>
    </div>

    <ul class="m-0 flex list-none flex-col rounded-xl bg-fill-quaternary p-0">
      <li
        v-for="(r, i) in rows"
        :key="`${group}-${i}`"
        :aria-hidden="i >= shown || undefined"
        class="grid grid-cols-[32px_minmax(0,1fr)_auto] items-center gap-3 px-3.5 py-2.5 transition-[opacity,translate] duration-(--duration-spring) ease-snappy [&+&]:shadow-[inset_0_1px_0_var(--color-separator)]"
        :class="i < shown ? 'opacity-100' : 'translate-y-2 opacity-0'"
      >
        <GAvatar size="sm" :tone="r.tone">{{ r.initials }}</GAvatar>
        <span class="flex min-w-0 flex-col">
          <span class="truncate text-subhead font-medium">{{ r.note }}</span>
          <span class="text-footnote text-label-secondary">{{ r.who }}</span>
        </span>
        <span
          :class="
            cn(
              'text-subhead font-medium tabular-nums transition-colors duration-(--duration-normal)',
              settled
                ? 'text-label-secondary line-through'
                : r.amount >= 0
                  ? 'text-positive'
                  : 'text-negative',
            )
          "
        >
          {{ (r.amount >= 0 ? '+' : '−') + fmt(r.amount) }}
        </span>
      </li>
    </ul>

    <GButton
      :variant="settled ? 'filled' : 'tinted'"
      :aria-pressed="settled"
      :class="settled ? '[--glass-tint:var(--color-green)]' : undefined"
      @click="settled = !settled"
    >
      <Check v-if="settled" /><HandCoins v-else />{{ settled ? 'Settled · undo' : 'Settle up' }}
    </GButton>
  </article>
</template>
