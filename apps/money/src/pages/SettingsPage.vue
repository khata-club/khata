<script setup lang="ts">
import {
  KAlertDialog,
  KButton,
  KDialog,
  KProfileSummary,
  KSegmentedControl,
  KSwitchCard,
  KTextField,
} from '@khata/ui'
import { Plus } from '@lucide/vue'
import { useQueryClient } from '@tanstack/vue-query'
import { computed, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'

import { CATEGORY_ICONS, type CategoryIcon as Icon, type CategoryKind } from '#shared/constants'
import type { Category, Me } from '#shared/types'
import CategoryIcon from '@/components/CategoryIcon.vue'
import PageHeader from '@/components/PageHeader.vue'
import { api } from '@/lib/api'
import { setConsent, storedConsent, track } from '@/lib/analytics'
import { signOut } from '@/lib/auth'
import { CATEGORY_ICON } from '@/lib/icons'
import { useCategories, useMe, useMutate } from '@/lib/queries'

const router = useRouter()
const qc = useQueryClient()
const me = useMe()
const categories = useCategories()

// Analytics consent mirrors localStorage (what gtag uses) and the profile.
const consent = ref(storedConsent() ?? me.data.value?.prefs.analyticsConsent ?? false)
const gaEnabled = !!import.meta.env.VITE_GA_MEASUREMENT_ID
async function onConsent(v: boolean) {
  consent.value = v
  setConsent(v)
  const p = await api.patch<Me['prefs']>('/me/prefs', { analyticsConsent: v })
  qc.setQueryData<Me>(['me'], (m) => (m ? { ...m, prefs: p } : m))
}

// Categories
const kind = ref<CategoryKind>('expense')
const list = computed(() => (categories.data.value ?? []).filter((c) => c.kind === kind.value))
const open = ref(false)
const editing = ref<Category | null>(null)
const form = reactive({ name: '', icon: 'circle' as Icon, color: '#6b7280' })
function edit(c: Category | null) {
  editing.value = c
  Object.assign(form, {
    name: c?.name ?? '',
    icon: c?.icon ?? 'circle',
    color: c?.color ?? '#2563eb',
  })
  open.value = true
}
const save = useMutate(
  (body: object) =>
    editing.value
      ? api.patch(`/categories/${editing.value.id}`, body)
      : api.post('/categories', body),
  ['categories'],
  () => {
    if (!editing.value) track('category_create', { kind: kind.value })
    open.value = false
  },
)
const removeCat = useMutate(
  () => api.del(`/categories/${editing.value!.id}`),
  ['categories', 'budgets', 'transactions'],
  () => (open.value = false),
)

// Danger zone
const wipeOpen = ref(false)
const deleteOpen = ref(false)
const busy = ref(false)
async function wipe() {
  busy.value = true
  await api.del('/me/data')
  track('data_delete', { scope: 'data' })
  busy.value = false
  wipeOpen.value = false
  await qc.invalidateQueries()
  router.push({ name: 'onboarding' })
}
async function deleteAccount() {
  busy.value = true
  track('data_delete', { scope: 'account' })
  await api.del('/me')
  await signOut().catch(() => undefined)
  qc.clear()
  router.replace({ name: 'home' })
}
</script>

<template>
  <PageHeader title="Settings" />

  <section
    v-if="me.data.value"
    class="flex flex-wrap items-center gap-4 rounded-xl border border-line bg-surface p-6 shadow-raised"
  >
    <KProfileSummary
      :name="me.data.value.user.name"
      :subtitle="`${me.data.value.user.email} · signed in with Google`"
      :src="me.data.value.user.image ?? undefined"
      class="min-w-0 flex-1"
    />
  </section>

  <section class="flex flex-col gap-3">
    <h2 class="m-0 text-sm font-semibold tracking-label text-fg-muted uppercase">Privacy</h2>
    <KSwitchCard
      :model-value="consent"
      title="Share anonymous usage analytics"
      :description="
        gaEnabled
          ? 'Google Analytics events like “added an entry” — never amounts, names, payees or notes.'
          : 'Analytics is not configured on this server.'
      "
      :disabled="!gaEnabled"
      @update:model-value="onConsent"
    />
  </section>

  <section class="flex flex-col gap-3">
    <div class="flex flex-wrap items-center gap-3">
      <h2 class="m-0 text-sm font-semibold tracking-label text-fg-muted uppercase">Categories</h2>
      <KSegmentedControl
        v-model="kind"
        :options="[
          { value: 'expense', label: 'Expense' },
          { value: 'income', label: 'Income' },
        ]"
        label="Category kind"
        size="sm"
        class="ml-auto"
      />
      <KButton size="sm" variant="secondary" class="gap-1" @click="edit(null)"
        ><Plus :size="14" aria-hidden="true" />Add</KButton
      >
    </div>
    <ul
      class="m-0 grid list-none grid-cols-[repeat(auto-fill,minmax(min(100%,240px),1fr))] gap-2 p-0"
    >
      <li v-for="c in list" :key="c.id">
        <button
          type="button"
          class="flex w-full cursor-pointer items-center gap-3 rounded-lg border border-line bg-surface px-3 py-2.5 text-left hover:bg-surface-subtle"
          @click="edit(c)"
        >
          <CategoryIcon :category="c" :size="32" />
          <span class="truncate font-medium">{{ c.name }}</span>
        </button>
      </li>
    </ul>
  </section>

  <section class="flex flex-col gap-3 rounded-xl border border-danger-border bg-danger-subtle p-6">
    <h2 class="m-0 text-sm font-semibold tracking-label text-danger uppercase">Danger zone</h2>
    <p class="m-0 text-sm text-fg-muted">
      Export your data first from Import & export if you want a copy.
    </p>
    <div class="flex flex-wrap gap-2">
      <KAlertDialog
        v-model:open="wipeOpen"
        title="Erase all data?"
        description="Every entry, account, budget, bill, goal and investment is deleted. Your sign-in stays."
        confirm-label="Erase everything"
        :loading="busy"
        @confirm="wipe"
      >
        <template #trigger><KButton variant="secondary">Erase all data</KButton></template>
      </KAlertDialog>
      <KAlertDialog
        v-model:open="deleteOpen"
        title="Delete your account?"
        description="Your account and all of its data are permanently deleted. This can't be undone."
        confirm-label="Delete my account"
        :loading="busy"
        @confirm="deleteAccount"
      >
        <template #trigger><KButton variant="danger">Delete account</KButton></template>
      </KAlertDialog>
    </div>
  </section>

  <KDialog v-model:open="open" :title="editing ? 'Edit category' : 'New category'">
    <form
      id="cat-form"
      class="flex flex-col gap-4"
      @submit.prevent="
        form.name &&
        save.mutate({
          kind: editing?.kind ?? kind,
          name: form.name,
          icon: form.icon,
          color: form.color,
        })
      "
    >
      <KTextField v-model="form.name" label="Name" required maxlength="80" />
      <fieldset class="m-0 flex flex-col gap-2 border-0 p-0">
        <legend class="mb-2 text-sm font-semibold">Icon</legend>
        <div class="flex flex-wrap gap-1.5">
          <button
            v-for="i in CATEGORY_ICONS"
            :key="i"
            type="button"
            :aria-label="i"
            :aria-pressed="form.icon === i"
            class="grid size-10 cursor-pointer place-items-center rounded-md border bg-surface"
            :class="form.icon === i ? 'border-primary text-primary' : 'border-line text-fg-muted'"
            @click="form.icon = i"
          >
            <component :is="CATEGORY_ICON[i]" :size="18" />
          </button>
        </div>
      </fieldset>
      <label class="flex flex-col gap-2 text-sm font-semibold">
        Colour
        <input
          v-model="form.color"
          type="color"
          class="h-11 w-24 cursor-pointer rounded-md border border-line bg-surface p-1"
        />
      </label>
    </form>
    <template #footer>
      <KButton
        v-if="editing"
        variant="ghost"
        class="mr-auto text-danger"
        :loading="removeCat.isPending.value"
        @click="removeCat.mutate(undefined)"
        >Delete</KButton
      >
      <KButton variant="secondary" @click="open = false">Cancel</KButton>
      <KButton type="submit" form="cat-form" :disabled="!form.name" :loading="save.isPending.value"
        >Save</KButton
      >
    </template>
  </KDialog>
</template>
