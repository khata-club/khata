<script setup lang="ts">
import { KButton, KDialog, KProgressRings, KSegmentedControl, KTextField } from '@khata/ui'
import { Plus, Target } from '@lucide/vue'
import { computed, reactive, ref } from 'vue'

import { formatDate } from '#shared/dates'
import { formatINR } from '#shared/money'
import type { Goal } from '#shared/types'
import AmountField from '@/components/AmountField.vue'
import EmptyState from '@/components/EmptyState.vue'
import PageHeader from '@/components/PageHeader.vue'
import { api } from '@/lib/api'
import { track } from '@/lib/analytics'
import { CATEGORY_ICON } from '@/lib/icons'
import { rupees } from '@/lib/charts'
import { useGoals, useMutate } from '@/lib/queries'

const goals = useGoals()
const active = computed(() => (goals.data.value ?? []).filter((g) => !g.archived))
const rings = computed(() =>
  active.value
    .slice(0, 4)
    .map((g) => ({ label: g.name, saved: rupees(g.saved), target: rupees(g.target) })),
)

// Create / edit
const open = ref(false)
const editing = ref<Goal | null>(null)
const form = reactive({
  name: '',
  target: null as number | null,
  targetDate: '',
  saved: null as number | null,
})
function edit(g: Goal | null) {
  editing.value = g
  Object.assign(form, {
    name: g?.name ?? '',
    target: g?.target ?? null,
    targetDate: g?.targetDate ?? '',
    saved: null,
  })
  open.value = true
}
const save = useMutate(
  (body: object) =>
    editing.value
      ? api.patch<Goal>(`/goals/${editing.value.id}`, body)
      : api.post<Goal>('/goals', body),
  ['goals'],
  () => {
    if (!editing.value) track('goal_create', {})
    open.value = false
  },
)
const remove = useMutate(
  () => api.del(`/goals/${editing.value!.id}`),
  ['goals'],
  () => (open.value = false),
)

// Contribute
const contribOpen = ref(false)
const contribGoal = ref<Goal | null>(null)
const contrib = reactive({ amount: null as number | null, direction: 'add' as 'add' | 'withdraw' })
function contribute(g: Goal) {
  contribGoal.value = g
  Object.assign(contrib, { amount: null, direction: 'add' })
  contribOpen.value = true
}
const addContribution = useMutate(
  (v: { id: string; amount: number }) =>
    api.post<Goal>(`/goals/${v.id}/contributions`, { amount: v.amount }),
  ['goals'],
  (_r, v) => {
    track('goal_contribute', { direction: v.amount > 0 ? 'add' : 'withdraw' })
    contribOpen.value = false
  },
)

function startWith(name: string) {
  edit(null)
  form.name = name
}

const pct = (g: Goal) => Math.min(100, Math.round((g.saved / g.target) * 100))
const ideas = [
  'Emergency fund (6 months)',
  'Home down payment',
  'Child’s education',
  'New car',
  'Wedding',
  'Vacation',
]
</script>

<template>
  <PageHeader
    title="Goals"
    subtitle="Save towards what matters, and see the monthly amount it takes."
  >
    <template #actions>
      <KButton class="gap-2" @click="edit(null)"
        ><Plus :size="18" aria-hidden="true" />New goal</KButton
      >
    </template>
  </PageHeader>

  <EmptyState
    v-if="goals.data.value && !active.length"
    :icon="Target"
    title="No goals yet"
    body="An emergency fund of 6 months' expenses is a great first goal."
  >
    <KButton
      v-for="i in ideas.slice(0, 3)"
      :key="i"
      variant="secondary"
      size="sm"
      @click="startWith(i)"
      >{{ i }}</KButton
    >
  </EmptyState>

  <div v-else-if="active.length" class="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
    <ul class="m-0 flex list-none flex-col gap-4 p-0">
      <li
        v-for="g in active"
        :key="g.id"
        class="flex flex-col gap-4 rounded-xl border border-line bg-surface p-5 shadow-raised"
      >
        <div class="flex items-center gap-3">
          <span class="grid size-10 place-items-center rounded-full bg-primary-subtle text-primary">
            <component :is="CATEGORY_ICON[g.icon]" :size="20" aria-hidden="true" />
          </span>
          <button
            type="button"
            class="flex min-w-0 flex-1 cursor-pointer flex-col border-0 bg-transparent p-0 text-left"
            @click="edit(g)"
          >
            <span class="truncate font-semibold">{{ g.name }}</span>
            <span class="text-xs text-fg-muted">{{
              g.targetDate ? `By ${formatDate(g.targetDate)}` : 'No deadline'
            }}</span>
          </button>
          <span class="font-mono text-sm font-semibold">{{ pct(g) }}%</span>
        </div>
        <span class="h-2 overflow-hidden rounded-full bg-surface-recessed" aria-hidden="true">
          <span
            class="block h-full rounded-full bg-primary transition-[width] duration-(--duration-slow)"
            :style="{ width: `${pct(g)}%` }"
          />
        </span>
        <div class="flex flex-wrap items-center gap-3">
          <span class="font-mono text-sm tabular-nums"
            >{{ formatINR(g.saved) }}
            <span class="text-fg-muted">of {{ formatINR(g.target) }}</span></span
          >
          <span v-if="g.monthlyNeeded" class="text-xs text-fg-muted"
            >· save {{ formatINR(g.monthlyNeeded) }}/month to make it</span
          >
          <span v-else-if="g.saved >= g.target" class="text-xs font-semibold text-success"
            >· Reached 🎉</span
          >
          <KButton size="sm" variant="secondary" class="ml-auto" @click="contribute(g)"
            >Add money</KButton
          >
        </div>
      </li>
    </ul>
    <KProgressRings v-if="rings.length" :goals="rings" title="Progress" />
  </div>

  <KDialog v-model:open="open" :title="editing ? 'Edit goal' : 'New goal'">
    <form
      id="goal-form"
      class="flex flex-col gap-4"
      @submit.prevent="
        form.name &&
        form.target &&
        save.mutate({
          name: form.name,
          target: form.target,
          targetDate: form.targetDate || null,
          ...(editing ? {} : { saved: form.saved ?? 0 }),
        })
      "
    >
      <KTextField
        v-model="form.name"
        label="Goal"
        required
        maxlength="80"
        placeholder="e.g. Emergency fund"
      />
      <AmountField v-model="form.target" label="Target amount" required />
      <KTextField v-model="form.targetDate" label="Target date" type="date" optional />
      <AmountField v-if="!editing" v-model="form.saved" label="Already saved" optional />
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
      <KButton
        type="submit"
        form="goal-form"
        :disabled="!form.name || !form.target"
        :loading="save.isPending.value"
        >Save</KButton
      >
    </template>
  </KDialog>

  <KDialog
    v-model:open="contribOpen"
    :title="contribGoal?.name ?? 'Goal'"
    description="Log money set aside (or taken out) for this goal."
  >
    <form
      id="contrib-form"
      class="flex flex-col gap-4"
      @submit.prevent="
        contribGoal &&
        contrib.amount &&
        addContribution.mutate({
          id: contribGoal.id,
          amount: contrib.direction === 'add' ? contrib.amount : -contrib.amount,
        })
      "
    >
      <KSegmentedControl
        v-model="contrib.direction"
        :options="[
          { value: 'add', label: 'Add' },
          { value: 'withdraw', label: 'Withdraw' },
        ]"
        label="Direction"
      />
      <AmountField v-model="contrib.amount" label="Amount" required />
    </form>
    <template #footer>
      <KButton variant="secondary" @click="contribOpen = false">Cancel</KButton>
      <KButton
        type="submit"
        form="contrib-form"
        :disabled="!contrib.amount"
        :loading="addContribution.isPending.value"
        >Save</KButton
      >
    </template>
  </KDialog>
</template>
