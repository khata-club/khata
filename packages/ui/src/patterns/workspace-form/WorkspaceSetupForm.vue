<script setup lang="ts">
import {
  ArrowLeft,
  Check as CheckIcon,
  CircleAlert,
  CircleCheck,
  CloudCheck,
  CloudOff,
  Copy,
  CreditCard,
  LoaderCircle,
  Lock,
} from '@lucide/vue'
import { computed, nextTick, onBeforeUnmount, reactive, ref, type Component } from 'vue'

import KButton from '../../components/KButton.vue'
import KCheckbox from '../../components/KCheckbox.vue'
import KLabel from '../../components/KLabel.vue'
import KSegmentedControl from '../../components/KSegmentedControl.vue'
import KSelect from '../../components/KSelect.vue'
import KSwitch from '../../components/KSwitch.vue'
import KBanner from '../../forms/KBanner.vue'
import KChoiceCards from '../../forms/KChoiceCards.vue'
import KErrorSummary from '../../forms/KErrorSummary.vue'
import KFormProgress, { type FormProgressSection } from '../../forms/KFormProgress.vue'
import KTextarea from '../../forms/KTextarea.vue'
import KTextField from '../../forms/KTextField.vue'
import type { FieldStatus } from '../../forms/types'
import { cn } from '../../lib/cn'
import {
  ALL,
  BLANK,
  COMPLETE,
  HELP,
  LABELS,
  NOTES_MAX,
  PARTIAL,
  POSITIVE,
  REQUIRED,
  SECTIONS,
  check,
  isEmailShaped,
  mask,
  slugify,
  type EmailCheck,
  type FieldName,
  type FormValues,
  type TextFieldName,
} from './validation'

type Mode = 'pristine' | 'partial' | 'submitting' | 'success' | 'locked'

const {
  validateOn = 'blur',
  errorSummary = true,
  requiredStyle = 'asterisk',
  initialMode = 'partial',
} = defineProps<{
  /** When field errors appear before the first submit. */
  validateOn?: 'blur' | 'change' | 'submit'
  /** Show the linked error summary after a failed submit. */
  errorSummary?: boolean
  /** Mark required fields with `*`, or label optional ones "Optional". */
  requiredStyle?: 'asterisk' | 'optional'
  initialMode?: Mode
}>()

const MODES = [
  { value: 'pristine', label: 'Pristine' },
  { value: 'partial', label: 'Partial errors' },
  { value: 'submitting', label: 'Submitting' },
  { value: 'success', label: 'Success' },
  { value: 'locked', label: 'Disabled' },
]
const SIZES = [
  { value: '1-10', label: '1–10', description: 'Starter' },
  { value: '11-50', label: '11–50', description: 'Team' },
  { value: '51-200', label: '51–200', description: 'Business' },
  { value: '200+', label: '200+', description: 'Contact sales', disabled: true },
]
const INDUSTRIES = [
  { value: 'design', label: 'Design & creative' },
  { value: 'software', label: 'Software' },
  { value: 'education', label: 'Education' },
  { value: 'health', label: 'Healthcare' },
  { value: 'nonprofit', label: 'Nonprofit' },
  { value: 'other', label: 'Other' },
]
const PREFS = [
  { k: 'updates', label: 'Product updates', sub: 'Monthly, no more than one email.' },
  { k: 'digest', label: 'Weekly activity digest', sub: 'Mondays at 9:00.' },
  { k: 'security', label: 'Security alerts', sub: 'Required for workspace owners.', fixed: true },
] as const
const SWITCHES = [
  { k: 'twofa', label: 'Require two-factor sign-in', sub: 'Applies to every member.' },
  { k: 'sso', label: 'Single sign-on (SAML)', sub: 'Available on the Business plan.', fixed: true },
] as const

// ---- state ----------------------------------------------------------------------------------
const mode = ref<Mode>(initialMode)
const v = reactive<FormValues>({ ...BLANK })
const touched = reactive<Partial<Record<FieldName, boolean>>>({})
const dirty = reactive<Partial<Record<FieldName, boolean>>>({})
const submitted = ref(false)
const submitting = ref(false)
const success = ref(false)
const emailCheck = ref<EmailCheck | null>(null)
const emailChecking = ref(false)
const slugEdited = ref(false)
const draftSaved = ref(false)
const vatCopied = ref(false)
const shakeN = ref(0)
const summary = ref<InstanceType<typeof KErrorSummary>>()
const timers: Record<string, ReturnType<typeof setTimeout>> = {}
const later = (k: string, ms: number, fn: () => void) => {
  clearTimeout(timers[k])
  timers[k] = setTimeout(fn, ms)
}
onBeforeUnmount(() => Object.values(timers).forEach(clearTimeout))

function setMode(m: Mode) {
  Object.values(timers).forEach(clearTimeout)
  mode.value = m
  const ok = { value: COMPLETE.email, ok: true }
  Object.assign(v, m === 'pristine' ? BLANK : m === 'partial' ? PARTIAL : COMPLETE)
  for (const k of Object.keys(touched)) delete touched[k as FieldName]
  for (const k of Object.keys(dirty)) delete dirty[k as FieldName]
  submitted.value = m === 'partial' || m === 'submitting' || m === 'success'
  submitting.value = m === 'submitting'
  success.value = m === 'success'
  emailCheck.value = m === 'pristine' || m === 'partial' ? null : ok
  emailChecking.value = false
  slugEdited.value = m === 'partial'
  draftSaved.value = false
  shakeN.value = 0
}
setMode(initialMode)

const locked = computed(() => mode.value === 'locked')
const inert = computed(() => locked.value || submitting.value || success.value)

// ---- validation -----------------------------------------------------------------------------
const result = (n: FieldName) => check(n, v, emailCheck.value)
function shown(n: FieldName) {
  if (submitted.value) return true
  if (validateOn === 'submit') return false
  if (validateOn === 'change') return !!(dirty[n] || touched[n])
  return !!touched[n]
}
function status(n: FieldName): FieldStatus | 'disabled' | 'readonly' {
  if (locked.value) return 'disabled'
  if (submitting.value || success.value) return 'readonly'
  if (n === 'email' && emailChecking.value) return 'loading'
  const r = result(n)
  const show = shown(n)
  if (show && r.err) return 'error'
  if (r.warn && (show || dirty[n])) return 'warning'
  if (show && r.ok && POSITIVE.includes(n)) return 'valid'
  return 'default'
}
/** Props for a KTextField / KTextarea bound to `n`. */
function field(n: FieldName) {
  const st = status(n)
  const r = result(n)
  const fs: FieldStatus = st === 'disabled' || st === 'readonly' ? 'default' : st
  const message =
    st === 'error'
      ? r.err
      : st === 'warning'
        ? r.warn
        : st === 'valid'
          ? r.ok
          : st === 'loading'
            ? 'Checking availability…'
            : undefined
  return {
    id: `f-${n}`,
    name: n,
    label: LABELS[n],
    status: fs,
    message,
    hint: HELP[n],
    disabled: st === 'disabled',
    readonly: st === 'readonly',
    // Required fields stay aria-required in both styles; only the visible marker changes.
    required: REQUIRED.includes(n),
    hideRequiredMark: requiredStyle !== 'asterisk',
    optional: !REQUIRED.includes(n) && requiredStyle === 'optional',
  }
}

const errFields = computed(() => ALL.filter((n) => status(n) === 'error'))
const reqDone = computed(() =>
  REQUIRED.filter((n) => {
    const val = v[n]
    return (typeof val === 'string' ? val.trim() : val) && !result(n).err
  }),
)

const sideSections = computed<FormProgressSection[]>(() =>
  SECTIONS.map((s) => {
    const errs = s.fields.filter((n) => status(n) === 'error').length
    const req = s.fields.filter((n) => REQUIRED.includes(n))
    const done = req.filter((n) => reqDone.value.includes(n)).length
    const complete = errs === 0 && done === req.length
    return {
      href: `#sec-${s.id}`,
      title: s.title,
      meta: errs
        ? `${errs} issue${errs > 1 ? 's' : ''}`
        : complete
          ? 'Complete'
          : `${done} of ${req.length}`,
      state: errs ? 'error' : complete ? 'complete' : 'pending',
    }
  }),
)
const secMeta = (id: string) => sideSections.value.find((s) => s.href === `#sec-${id}`)!

// ---- events ---------------------------------------------------------------------------------
function onInput(n: TextFieldName, raw: string) {
  if (inert.value) return
  const val = mask(n, raw)
  v[n] = val
  dirty[n] = true
  draftSaved.value = false
  if (n === 'slug') slugEdited.value = true
  if (n === 'workspace' && !slugEdited.value) {
    v.slug = slugify(val)
    dirty.slug = true
  }
  if (n === 'email') emailCheck.value = null
}
function onBlur(n: FieldName) {
  touched[n] = true
  if (n === 'email') verifyEmail()
}
function verifyEmail() {
  const t = v.email.trim()
  if (inert.value || !isEmailShaped(t)) return
  if (emailCheck.value?.value === t) return
  emailChecking.value = true
  later('email', 1100, () => {
    emailChecking.value = false
    emailCheck.value = { value: t, ok: !/^(admin|hello|team)@/i.test(t) }
  })
}
function setVal<K extends keyof FormValues>(k: K, val: FormValues[K]) {
  if (inert.value) return
  v[k] = val
  if (k in LABELS) touched[k as FieldName] = true
  draftSaved.value = false
}
function copyVat() {
  navigator.clipboard?.writeText(v.vat).catch(() => undefined)
  vatCopied.value = true
  later('vat', 1400, () => (vatCopied.value = false))
}
async function onSubmit() {
  if (inert.value) return
  const errs = ALL.filter((n) => result(n).err)
  if (errs.length) {
    submitted.value = true
    shakeN.value++
    await nextTick()
    if (errorSummary && summary.value) summary.value.focus()
    else document.getElementById(focusId(errs[0]!))?.focus()
    return
  }
  submitted.value = true
  submitting.value = true
  mode.value = 'submitting'
  later('sub', 1800, () => {
    submitting.value = false
    success.value = true
    mode.value = 'success'
  })
}
const focusId = (n: FieldName) => (n === 'size' ? 'f-size-0' : `f-${n}`)

// ---- derived UI -----------------------------------------------------------------------------
const showSummary = computed(
  () => errorSummary && submitted.value && !inert.value && errFields.value.length > 0,
)
const summaryTitle = computed(() => {
  const n = errFields.value.length
  return `${n} field${n > 1 ? 's' : ''} need${n > 1 ? '' : 's'} attention before you continue`
})
const summaryItems = computed(() =>
  errFields.value.map((n) => ({ id: focusId(n), label: LABELS[n], message: result(n).err ?? '' })),
)
const footerStatus = computed<{ text: string; cls: string; icon: Component }>(() => {
  if (locked.value) return { text: 'Locked for review', cls: 'text-fg-disabled', icon: Lock }
  if (success.value) return { text: 'Submitted', cls: 'text-success', icon: CircleCheck }
  if (submitting.value)
    return { text: 'Creating your workspace…', cls: 'text-fg-muted', icon: LoaderCircle }
  const n = errFields.value.length
  if (submitted.value && n)
    return {
      text: `${n} field${n > 1 ? 's' : ''} need attention`,
      cls: 'text-danger',
      icon: CircleAlert,
    }
  if (draftSaved.value)
    return { text: 'Draft saved · just now', cls: 'text-success', icon: CloudCheck }
  return { text: 'Not saved yet', cls: 'text-fg-muted', icon: CloudOff }
})
const yearly = computed(() => v.cycle === 'yearly')
const sizeStatus = computed(() => status('size'))
const industryStatus = computed(() => status('industry'))
const termsInvalid = computed(() => status('terms') === 'error')
const req = (n: FieldName) => REQUIRED.includes(n) && requiredStyle === 'asterisk'
</script>

<template>
  <div class="min-h-screen bg-canvas font-sans text-fg">
    <header class="mx-auto flex max-w-[1180px] flex-col gap-6 px-6 pt-12 pb-8">
      <a
        href="#"
        class="inline-flex items-center gap-2 self-start text-sm font-semibold text-primary no-underline hover:text-primary-pressed"
      >
        <ArrowLeft :size="16" aria-hidden="true" />Component library
      </a>
      <div class="flex flex-wrap items-end justify-between gap-6 border-b border-line pb-5">
        <div class="flex flex-col gap-1">
          <span class="font-mono text-xs text-fg-muted">Level 05 · Patterns</span>
          <h1 class="m-0 text-3xl font-semibold">Forms</h1>
          <p class="mt-1 mb-0 max-w-[560px] text-base [text-wrap:pretty] text-fg-muted">
            A full workspace-setup form built from CALM / KIT atoms. Switch form state to inspect
            every field condition.
          </p>
        </div>
        <div class="flex flex-col gap-2">
          <span class="text-xs font-semibold tracking-label text-fg-muted uppercase"
            >Form state</span
          >
          <KSegmentedControl
            :model-value="mode"
            :options="MODES"
            label="Form state"
            @update:model-value="setMode($event as Mode)"
          />
        </div>
      </div>
    </header>

    <main class="mx-auto flex max-w-[1180px] flex-wrap items-start gap-8 px-6 pb-16">
      <form
        novalidate
        class="flex min-w-0 flex-[1_1_560px] flex-col gap-6"
        @submit.prevent="onSubmit"
      >
        <KErrorSummary
          v-if="showSummary"
          ref="summary"
          :title="summaryTitle"
          :items="summaryItems"
        />
        <KBanner v-if="success" tone="success" title="Workspace created">
          {{ v.workspace || 'Your workspace' }} is live at calm.app/{{ v.slug }}. Invites go out
          when you add teammates.
          <template #action
            ><KButton variant="secondary" size="sm" @click="setMode('pristine')"
              >Start over</KButton
            ></template
          >
        </KBanner>
        <KBanner v-if="locked" tone="neutral" title="Locked for review">
          An admin is reviewing this request. Fields unlock if changes are requested.
        </KBanner>

        <!-- 01 Account owner -->
        <article
          id="sec-account"
          class="flex scroll-mt-6 flex-col gap-6 rounded-xl border border-line bg-surface p-8 shadow-raised"
        >
          <header class="flex flex-wrap items-baseline gap-4">
            <span class="font-mono text-sm text-fg-muted">01.</span>
            <h2 class="m-0 text-sm font-semibold tracking-label uppercase">Account owner</h2>
            <span
              :class="
                cn(
                  'ml-auto font-mono text-xs',
                  { error: 'text-danger', complete: 'text-success', pending: 'text-fg-muted' }[
                    secMeta('account').state
                  ],
                )
              "
              >{{ secMeta('account').meta }}</span
            >
          </header>
          <div
            class="grid grid-cols-[repeat(auto-fit,minmax(min(100%,220px),1fr))] items-start gap-x-5 gap-y-4"
          >
            <KTextField
              v-bind="field('firstName')"
              :model-value="v.firstName"
              autocomplete="given-name"
              @update:model-value="onInput('firstName', $event)"
              @blur="onBlur('firstName')"
            />
            <KTextField
              v-bind="field('lastName')"
              :model-value="v.lastName"
              autocomplete="family-name"
              @update:model-value="onInput('lastName', $event)"
              @blur="onBlur('lastName')"
            />
            <KTextField
              v-bind="field('email')"
              :model-value="v.email"
              type="email"
              autocomplete="email"
              placeholder="name@company.com"
              @update:model-value="onInput('email', $event)"
              @blur="onBlur('email')"
            />
            <KTextField
              v-bind="field('phone')"
              :model-value="v.phone"
              type="tel"
              autocomplete="tel-national"
              placeholder="415 555 0132"
              @update:model-value="onInput('phone', $event)"
              @blur="onBlur('phone')"
            >
              <template #prefix>
                <select
                  v-model="v.phoneCode"
                  aria-label="Country code"
                  :disabled="inert"
                  class="h-full shrink-0 cursor-pointer appearance-none border-0 border-r border-line bg-transparent pr-3 pl-4 text-base font-semibold text-inherit outline-hidden disabled:cursor-not-allowed"
                  @blur="onBlur('phone')"
                >
                  <option value="+1">US +1</option>
                  <option value="+44">UK +44</option>
                  <option value="+49">DE +49</option>
                  <option value="+61">AU +61</option>
                </select>
                <span class="w-3 shrink-0" />
              </template>
            </KTextField>
          </div>
        </article>

        <!-- 02 Workspace -->
        <article
          id="sec-workspace"
          class="flex scroll-mt-6 flex-col gap-6 rounded-xl border border-line bg-surface p-8 shadow-raised"
        >
          <header class="flex flex-wrap items-baseline gap-4">
            <span class="font-mono text-sm text-fg-muted">02.</span>
            <h2 class="m-0 text-sm font-semibold tracking-label uppercase">Workspace</h2>
            <span
              :class="
                cn(
                  'ml-auto font-mono text-xs',
                  { error: 'text-danger', complete: 'text-success', pending: 'text-fg-muted' }[
                    secMeta('workspace').state
                  ],
                )
              "
              >{{ secMeta('workspace').meta }}</span
            >
          </header>
          <div
            class="grid grid-cols-[repeat(auto-fit,minmax(min(100%,220px),1fr))] items-start gap-x-5 gap-y-4"
          >
            <KTextField
              v-bind="field('workspace')"
              :model-value="v.workspace"
              autocomplete="organization"
              @update:model-value="onInput('workspace', $event)"
              @blur="onBlur('workspace')"
            />
            <div class="flex min-w-0 flex-col gap-2">
              <KLabel for="f-industry" :required="req('industry')" :disabled="locked"
                >Industry</KLabel
              >
              <KSelect
                id="f-industry"
                :model-value="v.industry || undefined"
                :options="INDUSTRIES"
                placeholder="Select an industry…"
                :invalid="industryStatus === 'error'"
                :disabled="industryStatus === 'disabled' || industryStatus === 'readonly'"
                aria-required="true"
                aria-describedby="f-industry-help"
                @update:model-value="setVal('industry', $event ?? '')"
              />
              <span
                id="f-industry-help"
                aria-live="polite"
                :class="
                  cn(
                    'min-h-5 text-sm',
                    industryStatus === 'error' ? 'text-danger' : 'text-fg-muted',
                  )
                "
              >
                {{ industryStatus === 'error' ? result('industry').err : '' }}
              </span>
            </div>
            <KTextField
              v-bind="field('slug')"
              :model-value="v.slug"
              autocomplete="off"
              spellcheck="false"
              class="col-span-full"
              @update:model-value="onInput('slug', $event)"
              @blur="onBlur('slug')"
            >
              <template #prefix
                ><span class="shrink-0 pr-2 pl-4 font-mono text-sm text-fg-muted"
                  >calm.app/</span
                ></template
              >
            </KTextField>
            <fieldset
              class="col-span-full m-0 flex min-w-0 flex-col gap-2 border-0 p-0"
              aria-describedby="f-size-help"
            >
              <legend class="mb-2 p-0 text-sm font-semibold" :class="locked && 'text-fg-disabled'">
                Team size<span v-if="req('size')" aria-hidden="true" class="text-danger"> *</span>
              </legend>
              <KChoiceCards
                :model-value="v.size"
                :options="SIZES"
                label="Team size"
                :required="REQUIRED.includes('size')"
                id-prefix="f-size"
                :invalid="sizeStatus === 'error'"
                :disabled="locked"
                :readonly="inert"
                :shake-key="shakeN"
                @update:model-value="setVal('size', $event ?? '')"
              />
              <span
                id="f-size-help"
                aria-live="polite"
                :class="
                  cn('min-h-5 text-sm', sizeStatus === 'error' ? 'text-danger' : 'text-fg-muted')
                "
              >
                {{ sizeStatus === 'error' ? result('size').err : '' }}
              </span>
            </fieldset>
          </div>
        </article>

        <!-- 03 Billing -->
        <article
          id="sec-billing"
          class="flex scroll-mt-6 flex-col gap-6 rounded-xl border border-line bg-surface p-8 shadow-raised"
        >
          <header class="flex flex-wrap items-baseline gap-4">
            <span class="font-mono text-sm text-fg-muted">03.</span>
            <h2 class="m-0 text-sm font-semibold tracking-label uppercase">Billing</h2>
            <span
              :class="
                cn(
                  'ml-auto font-mono text-xs',
                  { error: 'text-danger', complete: 'text-success', pending: 'text-fg-muted' }[
                    secMeta('billing').state
                  ],
                )
              "
              >{{ secMeta('billing').meta }}</span
            >
          </header>
          <div class="flex flex-wrap items-center justify-between gap-4">
            <KSegmentedControl
              :model-value="v.cycle"
              :options="[
                { value: 'monthly', label: 'Monthly' },
                { value: 'yearly', label: 'Yearly −20%' },
              ]"
              label="Billing cycle"
              :disabled="inert"
              :class="locked ? 'opacity-55' : undefined"
              @update:model-value="setVal('cycle', $event as FormValues['cycle'])"
            />
            <span class="text-sm text-fg-muted"
              ><span class="text-2xl font-semibold text-fg tabular-nums">{{
                yearly ? '$9.60' : '$12'
              }}</span>
              {{ yearly ? 'per seat / month, billed yearly' : 'per seat / month' }}</span
            >
          </div>
          <div
            class="grid grid-cols-[repeat(auto-fit,minmax(min(100%,220px),1fr))] items-start gap-x-5 gap-y-4"
          >
            <KTextField
              v-bind="field('card')"
              :model-value="v.card"
              mono
              inputmode="numeric"
              autocomplete="cc-number"
              placeholder="1234 5678 9012 3456"
              class="col-span-full"
              @update:model-value="onInput('card', $event)"
              @blur="onBlur('card')"
            >
              <template #leading><CreditCard /></template>
            </KTextField>
            <KTextField
              v-bind="field('expiry')"
              :model-value="v.expiry"
              inputmode="numeric"
              autocomplete="cc-exp"
              placeholder="MM/YY"
              @update:model-value="onInput('expiry', $event)"
              @blur="onBlur('expiry')"
            />
            <KTextField
              v-bind="field('cvc')"
              :model-value="v.cvc"
              inputmode="numeric"
              autocomplete="cc-csc"
              placeholder="123"
              @update:model-value="onInput('cvc', $event)"
              @blur="onBlur('cvc')"
            />
            <div class="flex min-w-0 flex-col gap-2">
              <KLabel for="f-country" disabled>Billing country</KLabel>
              <KSelect
                id="f-country"
                model-value="uk"
                :options="[{ value: 'uk', label: 'United Kingdom' }]"
                disabled
                aria-describedby="f-country-help"
              />
              <span id="f-country-help" class="min-h-5 text-sm text-fg-muted"
                >Set by your account region.</span
              >
            </div>
            <KTextField
              id="f-vat"
              label="VAT ID"
              :model-value="v.vat"
              readonly
              mono
              hint="Read-only. Pulled from your tax profile."
            >
              <template #trailing>
                <button
                  type="button"
                  aria-label="Copy VAT ID"
                  :class="
                    cn(
                      'mr-2 grid size-9 shrink-0 cursor-pointer place-items-center rounded-sm border-0 transition-colors duration-(--duration-normal)',
                      vatCopied
                        ? 'bg-success-subtle text-success'
                        : 'bg-transparent text-fg-muted hover:bg-surface-recessed',
                    )
                  "
                  @click="copyVat"
                >
                  <CheckIcon v-if="vatCopied" :size="16" aria-hidden="true" /><Copy
                    v-else
                    :size="16"
                    aria-hidden="true"
                  />
                </button>
              </template>
            </KTextField>
          </div>
        </article>

        <!-- 04 Preferences -->
        <article
          id="sec-preferences"
          class="flex scroll-mt-6 flex-col gap-6 rounded-xl border border-line bg-surface p-8 shadow-raised"
        >
          <header class="flex flex-wrap items-baseline gap-4">
            <span class="font-mono text-sm text-fg-muted">04.</span>
            <h2 class="m-0 text-sm font-semibold tracking-label uppercase">Preferences</h2>
            <span
              :class="
                cn(
                  'ml-auto font-mono text-xs',
                  { error: 'text-danger', complete: 'text-success', pending: 'text-fg-muted' }[
                    secMeta('preferences').state
                  ],
                )
              "
              >{{ secMeta('preferences').meta }}</span
            >
          </header>
          <div class="flex flex-wrap gap-6">
            <fieldset class="m-0 flex min-w-0 flex-[1_1_240px] flex-col border-0 p-0">
              <legend class="mb-1 p-0 text-xs font-semibold tracking-label text-fg-muted uppercase">
                Email me about
              </legend>
              <KCheckbox
                v-for="p in PREFS"
                :key="p.k"
                :model-value="v[p.k]"
                :disabled="('fixed' in p && p.fixed) || locked"
                class="items-start py-2.5 [&>span:first-child]:mt-0.5"
                @update:model-value="setVal(p.k, $event === true)"
              >
                <span class="flex flex-col"
                  ><span class="font-semibold">{{ p.label }}</span
                  ><span class="text-sm text-fg-muted group-data-[disabled]:text-fg-disabled">{{
                    p.sub
                  }}</span></span
                >
              </KCheckbox>
            </fieldset>
            <div class="w-px self-stretch bg-line max-sm:hidden" />
            <fieldset class="m-0 flex min-w-0 flex-[1_1_240px] flex-col border-0 p-0">
              <legend class="mb-1 p-0 text-xs font-semibold tracking-label text-fg-muted uppercase">
                Security
              </legend>
              <KSwitch
                v-for="s in SWITCHES"
                :key="s.k"
                :model-value="v[s.k]"
                :disabled="('fixed' in s && s.fixed) || locked"
                class="items-start rounded-lg py-2.5"
                @update:model-value="setVal(s.k, $event)"
              >
                <span class="flex flex-col"
                  ><span class="font-semibold">{{ s.label }}</span
                  ><span class="text-sm text-fg-muted group-data-[disabled]:text-fg-disabled">{{
                    s.sub
                  }}</span></span
                >
              </KSwitch>
            </fieldset>
          </div>
          <div class="h-px bg-line" />
          <KTextarea
            v-bind="field('notes')"
            :model-value="v.notes"
            :max="NOTES_MAX"
            placeholder="Anything our team should know before your kickoff call"
            @update:model-value="onInput('notes', $event)"
            @blur="onBlur('notes')"
          />
          <div class="flex flex-col gap-1">
            <KCheckbox
              id="f-terms"
              :model-value="v.terms"
              :invalid="termsInvalid"
              :disabled="locked"
              aria-describedby="f-terms-help"
              class="items-start"
              @update:model-value="setVal('terms', $event === true)"
            >
              <span
                >I agree to the Terms of Service and Data Processing Addendum<span
                  v-if="req('terms')"
                  aria-hidden="true"
                  class="text-danger"
                >
                  *</span
                ></span
              >
            </KCheckbox>
            <span id="f-terms-help" aria-live="polite" class="min-h-5 pl-9 text-sm text-danger">{{
              termsInvalid ? result('terms').err : ''
            }}</span>
          </div>
        </article>

        <div class="flex flex-wrap items-center gap-3">
          <span
            role="status"
            :class="cn('mr-auto flex items-center gap-2 text-sm font-semibold', footerStatus.cls)"
          >
            <component
              :is="footerStatus.icon"
              :size="16"
              aria-hidden="true"
              :class="submitting && 'animate-ck-spin'"
            />{{ footerStatus.text }}
          </span>
          <KButton variant="outline" :disabled="inert" @click="draftSaved = !inert"
            >Save draft</KButton
          >
          <KButton
            type="submit"
            :loading="submitting"
            :disabled="locked || success"
            class="min-w-[190px]"
          >
            {{ submitting ? 'Creating…' : success ? 'Created' : 'Create workspace' }}
          </KButton>
        </div>
      </form>

      <KFormProgress
        :done="reqDone.length"
        :total="REQUIRED.length"
        :sections="sideSections"
        class="min-w-[260px] flex-[0_1_300px]"
      >
        <div class="h-px bg-line" />
        <div class="flex flex-col gap-1">
          <span class="text-xs font-semibold tracking-label uppercase">Try it</span>
          <span class="text-sm text-fg-muted">
            Use <span class="font-mono text-fg">admin@…</span> to see a taken email,
            <span class="font-mono text-fg">acme</span> for a taken URL, or a gmail address for a
            warning.
          </span>
        </div>
      </KFormProgress>
    </main>
  </div>
</template>
