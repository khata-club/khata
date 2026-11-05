<script setup lang="ts">
import { Check, HandCoins } from '@lucide/vue'
import { cn, KAvatar, KButton, useReducedMotion } from '@khata/ui'
import { ToggleGroupItem, ToggleGroupRoot } from 'reka-ui'
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'

interface Entry {
  who: string
  initials: string
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
      { who: 'Aanya paid', initials: 'AN', note: 'Villa, 3 nights', amount: 4200 },
      { who: 'You paid', initials: 'YO', note: 'Scooter rental', amount: 1800 },
      { who: 'Kabir paid', initials: 'KB', note: 'Seafood dinner', amount: -950 },
      { who: 'You paid', initials: 'YO', note: 'Fuel', amount: 600 },
    ],
  },
  {
    name: 'Flat 4B',
    rows: [
      { who: 'Meera paid', initials: 'MR', note: 'Electricity, Oct', amount: -820 },
      { who: 'You paid', initials: 'YO', note: 'Wi-Fi', amount: 450 },
      { who: 'Rohan paid', initials: 'RH', note: 'Groceries', amount: -1240 },
      { who: 'You paid', initials: 'YO', note: 'Cleaning', amount: 300 },
    ],
  },
  {
    name: 'Chai fund',
    rows: [
      { who: 'You paid', initials: 'YO', note: 'Monday round', amount: 120 },
      { who: 'Dev paid', initials: 'DV', note: 'Samosas', amount: -80 },
      { who: 'You paid', initials: 'YO', note: 'Thursday round', amount: 140 },
      { who: 'Isha paid', initials: 'IS', note: 'Biscuits', amount: -60 },
    ],
  },
]

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

function select(v: unknown) {
  if (typeof v !== 'string') return // keep one group selected
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
    class="flex min-w-0 flex-col gap-5 rounded-2xl border border-line bg-surface p-6 shadow-raised"
  >
    <!-- Toggle buttons (aria-pressed): picking a group swaps the ledger below in place. -->
    <ToggleGroupRoot
      type="single"
      :model-value="String(group)"
      aria-label="Ledger group"
      class="grid grid-cols-3 gap-1 rounded-lg bg-surface-recessed p-1 shadow-recessed"
      @update:model-value="select"
    >
      <ToggleGroupItem
        v-for="(g, i) in GROUPS"
        :key="g.name"
        :value="String(i)"
        class="h-10 cursor-pointer truncate rounded-[16px] border-0 bg-transparent text-sm font-semibold text-fg-muted transition-[background-color,box-shadow,color] duration-(--duration-normal) ease-standard data-[state=on]:bg-surface data-[state=on]:text-fg data-[state=on]:shadow-raised-sm"
      >
        {{ g.name }}
      </ToggleGroupItem>
    </ToggleGroupRoot>

    <div
      class="flex items-end justify-between gap-4 rounded-lg border border-line bg-surface-subtle p-5"
      aria-live="polite"
    >
      <div class="flex flex-col gap-1">
        <span class="text-xs font-semibold tracking-label text-fg-muted uppercase"
          >Your balance</span
        >
        <span
          :class="
            cn(
              'text-display font-bold tabular-nums transition-colors duration-(--duration-normal)',
              balance > 0 ? 'text-success' : balance < 0 ? 'text-danger' : 'text-fg',
            )
          "
        >
          {{ (balance < 0 ? '−' : '') + fmt(balance) }}
        </span>
      </div>
      <span class="pb-2 text-sm font-semibold text-fg-muted">{{
        settled ? 'All settled' : balance >= 0 ? 'owed to you' : 'you owe'
      }}</span>
    </div>

    <ul class="m-0 flex list-none flex-col p-0">
      <li
        v-for="(r, i) in rows"
        :key="`${group}-${i}`"
        :aria-hidden="i >= shown || undefined"
        class="grid grid-cols-[32px_minmax(0,1fr)_auto] items-center gap-3 border-t border-line py-3 transition-[opacity,translate] duration-(--duration-slow) ease-standard"
        :class="i < shown ? 'opacity-100' : 'translate-y-2 opacity-0'"
      >
        <KAvatar size="sm" class="text-primary shadow-none">{{ r.initials }}</KAvatar>
        <span class="flex min-w-0 flex-col">
          <span class="truncate text-sm font-semibold">{{ r.note }}</span>
          <span class="text-xs text-fg-muted">{{ r.who }}</span>
        </span>
        <span
          :class="
            cn(
              'font-mono text-sm font-medium transition-colors duration-(--duration-normal)',
              settled
                ? 'text-fg-muted line-through'
                : r.amount >= 0
                  ? 'text-success'
                  : 'text-danger',
            )
          "
        >
          {{ (r.amount >= 0 ? '+' : '−') + fmt(r.amount) }}
        </span>
      </li>
    </ul>

    <KButton
      variant="secondary"
      :aria-pressed="settled"
      :class="
        settled
          ? 'border-success-border bg-success-subtle text-success enabled:hover:border-success-border'
          : undefined
      "
      @click="settled = !settled"
    >
      <Check v-if="settled" /><HandCoins v-else />{{ settled ? 'Settled · undo' : 'Settle up' }}
    </KButton>
  </article>
</template>
