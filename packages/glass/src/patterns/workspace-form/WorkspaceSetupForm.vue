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

import GButton from '../../components/GButton.vue'
import GCheckbox from '../../components/GCheckbox.vue'
import GLabel from '../../components/GLabel.vue'
import GSegmentedControl from '../../components/GSegmentedControl.vue'
import GSelect from '../../components/GSelect.vue'
import GSwitch from '../../components/GSwitch.vue'
import GBanner from '../../forms/GBanner.vue'
import GChoiceCards from '../../forms/GChoiceCards.vue'
import GErrorSummary from '../../forms/GErrorSummary.vue'
import GFormProgress, { type FormProgressSection } from '../../forms/GFormProgress.vue'
import GTextarea from '../../forms/GTextarea.vue'
import GTextField from '../../forms/GTextField.vue'
import type { FieldStatus } from '../../forms/types'
import { cn } from '../../lib/cn'
import {
  ALL,
  BLANK,
  COMPLETE,
  HELP,
  LABELS,
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
const summary = ref<InstanceType<typeof GErrorSummary>>()
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
/** Props for a GTextField / GTextarea bound to `n`. */
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
    label: LABELS[n] === 'Notes' ? 'Notes for onboarding' : LABELS[n],
    status: fs,
    message,
    hint: HELP[n],
    disabled: st === 'disabled',
    readonly: st === 'readonly',
    required: REQUIRED.includes(n) && requiredStyle === 'asterisk',
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
function onInput(n: FieldName, raw: string) {
  if (inert.value) return
  const val = mask(n, raw)
  ;(v as unknown as Record<string, string>)[n] = val
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
  if (locked.value) return { text: 'Locked for review', cls: 'text-label-tertiary', icon: Lock }
  if (success.value) return { text: 'Submitted', cls: 'text-positive', icon: CircleCheck }
  if (submitting.value)
    return { text: 'Creating your workspace…', cls: 'text-label-secondary', icon: LoaderCircle }
  const n = errFields.value.length
  if (submitted.value && n)
    return {
      text: `${n} field${n > 1 ? 's' : ''} need attention`,
      cls: 'text-negative',
      icon: CircleAlert,
    }
  if (draftSaved.value)
    return { text: 'Draft saved · just now', cls: 'text-positive', icon: CloudCheck }
  return { text: 'Not saved yet', cls: 'text-label-secondary', icon: CloudOff }
})
const yearly = computed(() => v.cycle === 'yearly')
const sizeStatus = computed(() => status('size'))
const industryStatus = computed(() => status('industry'))
const termsInvalid = computed(() => status('terms') === 'error')
const req = (n: FieldName) => REQUIRED.includes(n) && requiredStyle === 'asterisk'
</script>

<template>
  <div class="-m-8 min-h-screen bg-canvas font-sans text-label">
    <header class="mx-auto flex max-w-[1180px] flex-col gap-6 px-6 pt-12 pb-8">
      <a
        href="#"
        class="inline-flex items-center gap-2 self-start text-subhead font-semibold text-tint no-underline hover:opacity-80"
      >
        <ArrowLeft :size="16" aria-hidden="true" />Component library
      </a>
      <div class="flex flex-wrap items-end justify-between gap-6 pb-2">
        <div class="flex flex-col gap-1">
          <span class="text-footnote text-label-secondary uppercase">Patterns</span>
          <h1 class="m-0 text-large-title font-bold">Forms</h1>
          <p class="mt-1 mb-0 max-w-[560px] text-body [text-wrap:pretty] text-label-secondary">
            A full workspace-setup form built from Glass Kit parts. Switch form state to inspect
            every field condition.
          </p>
        </div>
        <div class="flex flex-col gap-2">
          <span class="text-footnote text-label-secondary uppercase">Form state</span>
          <GSegmentedControl
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
        <GErrorSummary
          v-if="showSummary"
          ref="summary"
          :title="summaryTitle"
          :items="summaryItems"
        />
        <GBanner v-if="success" tone="positive" title="Workspace created">
          {{ v.workspace || 'Your workspace' }} is live at khata.club/{{ v.slug }}. Invites go out
          when you add teammates.
          <template #action
            ><GButton variant="gray" size="sm" @click="setMode('pristine')"
              >Start over</GButton
            ></template
          >
        </GBanner>
        <GBanner v-if="locked" tone="neutral" title="Locked for review">
          An admin is reviewing this request. Fields unlock if changes are requested.
        </GBanner>

        <!-- 01 Account owner -->
        <article
          id="sec-account"
          class="flex scroll-mt-6 flex-col gap-5 rounded-xl bg-surface p-6 max-sm:p-4"
        >
          <header class="flex flex-wrap items-baseline gap-3">
            <h2 class="m-0 text-title-3 font-semibold">Account owner</h2>
            <span
              :class="
                cn(
                  'ml-auto text-footnote tabular-nums',
                  {
                    error: 'text-negative',
                    complete: 'text-positive',
                    pending: 'text-label-secondary',
                  }[secMeta('account').state],
                )
              "
              >{{ secMeta('account').meta }}</span
            >
          </header>
          <div
            class="grid grid-cols-[repeat(auto-fit,minmax(min(100%,220px),1fr))] items-start gap-x-5 gap-y-4"
          >
            <GTextField
              v-bind="field('firstName')"
              :model-value="v.firstName"
              autocomplete="given-name"
              @update:model-value="onInput('firstName', $event)"
              @blur="onBlur('firstName')"
            />
            <GTextField
              v-bind="field('lastName')"
              :model-value="v.lastName"
              autocomplete="family-name"
              @update:model-value="onInput('lastName', $event)"
              @blur="onBlur('lastName')"
            />
            <GTextField
              v-bind="field('email')"
              :model-value="v.email"
              type="email"
              autocomplete="email"
              placeholder="name@company.com"
              @update:model-value="onInput('email', $event)"
              @blur="onBlur('email')"
            />
            <GTextField
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
                  class="h-full shrink-0 cursor-pointer appearance-none border-0 border-r border-separator bg-transparent pr-3 pl-4 text-body font-medium text-inherit outline-none disabled:cursor-not-allowed"
                  @blur="onBlur('phone')"
                >
                  <option value="+1">US +1</option>
                  <option value="+44">UK +44</option>
                  <option value="+49">DE +49</option>
                  <option value="+61">AU +61</option>
                </select>
                <span class="w-3 shrink-0" />
              </template>
            </GTextField>
          </div>
        </article>

        <!-- 02 Workspace -->
        <article
          id="sec-workspace"
          class="flex scroll-mt-6 flex-col gap-5 rounded-xl bg-surface p-6 max-sm:p-4"
        >
          <header class="flex flex-wrap items-baseline gap-3">
            <h2 class="m-0 text-title-3 font-semibold">Workspace</h2>
            <span
              :class="
                cn(
                  'ml-auto text-footnote tabular-nums',
                  {
                    error: 'text-negative',
                    complete: 'text-positive',
                    pending: 'text-label-secondary',
                  }[secMeta('workspace').state],
                )
              "
              >{{ secMeta('workspace').meta }}</span
            >
          </header>
          <div
            class="grid grid-cols-[repeat(auto-fit,minmax(min(100%,220px),1fr))] items-start gap-x-5 gap-y-4"
          >
            <GTextField
              v-bind="field('workspace')"
              :model-value="v.workspace"
              autocomplete="organization"
              @update:model-value="onInput('workspace', $event)"
              @blur="onBlur('workspace')"
            />
            <div class="flex min-w-0 flex-col gap-2">
              <GLabel for="f-industry" :required="req('industry')" :disabled="locked"
                >Industry</GLabel
              >
              <GSelect
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
                    'min-h-[18px] px-1 text-footnote',
                    industryStatus === 'error' ? 'text-negative' : 'text-label-secondary',
                  )
                "
              >
                {{ industryStatus === 'error' ? result('industry').err : '' }}
              </span>
            </div>
            <GTextField
              v-bind="field('slug')"
              :model-value="v.slug"
              autocomplete="off"
              spellcheck="false"
              class="col-span-full"
              @update:model-value="onInput('slug', $event)"
              @blur="onBlur('slug')"
            >
              <template #prefix
                ><span class="shrink-0 pr-2 pl-4 text-body text-label-secondary"
                  >khata.club/</span
                ></template
              >
            </GTextField>
            <fieldset
              class="col-span-full m-0 flex min-w-0 flex-col gap-2 border-0 p-0"
              aria-describedby="f-size-help"
            >
              <legend
                class="mb-1.5 p-0 text-subhead font-medium"
                :class="locked && 'text-label-tertiary'"
              >
                Team size<span v-if="req('size')" aria-hidden="true" class="text-negative"> *</span>
              </legend>
              <GChoiceCards
                :model-value="v.size"
                :options="SIZES"
                label="Team size"
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
                  cn(
                    'min-h-[18px] px-1 text-footnote',
                    sizeStatus === 'error' ? 'text-negative' : 'text-label-secondary',
                  )
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
          class="flex scroll-mt-6 flex-col gap-5 rounded-xl bg-surface p-6 max-sm:p-4"
        >
          <header class="flex flex-wrap items-baseline gap-3">
            <h2 class="m-0 text-title-3 font-semibold">Billing</h2>
            <span
              :class="
                cn(
                  'ml-auto text-footnote tabular-nums',
                  {
                    error: 'text-negative',
                    complete: 'text-positive',
                    pending: 'text-label-secondary',
                  }[secMeta('billing').state],
                )
              "
              >{{ secMeta('billing').meta }}</span
            >
          </header>
          <div class="flex flex-wrap items-center justify-between gap-4">
            <GSegmentedControl
              :model-value="v.cycle"
              :options="[
                { value: 'monthly', label: 'Monthly' },
                { value: 'yearly', label: 'Yearly −20%' },
              ]"
              label="Billing cycle"
              :disabled="inert"
              :class="locked ? 'opacity-40' : undefined"
              @update:model-value="setVal('cycle', $event as FormValues['cycle'])"
            />
            <span class="text-subhead text-label-secondary"
              ><span class="text-title-2 font-semibold text-label tabular-nums">{{
                yearly ? '$9.60' : '$12'
              }}</span>
              {{ yearly ? 'per seat / month, billed yearly' : 'per seat / month' }}</span
            >
          </div>
          <div
            class="grid grid-cols-[repeat(auto-fit,minmax(min(100%,220px),1fr))] items-start gap-x-5 gap-y-4"
          >
            <GTextField
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
            </GTextField>
            <GTextField
              v-bind="field('expiry')"
              :model-value="v.expiry"
              inputmode="numeric"
              autocomplete="cc-exp"
              placeholder="MM/YY"
              @update:model-value="onInput('expiry', $event)"
              @blur="onBlur('expiry')"
            />
            <GTextField
              v-bind="field('cvc')"
              :model-value="v.cvc"
              inputmode="numeric"
              autocomplete="cc-csc"
              placeholder="123"
              @update:model-value="onInput('cvc', $event)"
              @blur="onBlur('cvc')"
            />
            <div class="flex min-w-0 flex-col gap-2">
              <GLabel for="f-country" disabled>Billing country</GLabel>
              <GSelect
                id="f-country"
                model-value="uk"
                :options="[{ value: 'uk', label: 'United Kingdom' }]"
                disabled
                aria-describedby="f-country-help"
              />
              <span id="f-country-help" class="min-h-[18px] px-1 text-footnote text-label-secondary"
                >Set by your account region.</span
              >
            </div>
            <GTextField
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
                      'mr-2 grid size-9 shrink-0 cursor-pointer place-items-center rounded-full border-0 transition-colors duration-(--duration-normal)',
                      vatCopied
                        ? 'bg-positive-soft text-positive'
                        : 'bg-transparent text-label-secondary hover:bg-fill-tertiary',
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
            </GTextField>
          </div>
        </article>

        <!-- 04 Preferences -->
        <article
          id="sec-preferences"
          class="flex scroll-mt-6 flex-col gap-5 rounded-xl bg-surface p-6 max-sm:p-4"
        >
          <header class="flex flex-wrap items-baseline gap-3">
            <h2 class="m-0 text-title-3 font-semibold">Preferences</h2>
            <span
              :class="
                cn(
                  'ml-auto text-footnote tabular-nums',
                  {
                    error: 'text-negative',
                    complete: 'text-positive',
                    pending: 'text-label-secondary',
                  }[secMeta('preferences').state],
                )
              "
              >{{ secMeta('preferences').meta }}</span
            >
          </header>
          <div class="flex flex-wrap gap-6">
            <fieldset class="m-0 flex min-w-0 flex-[1_1_240px] flex-col border-0 p-0">
              <legend class="mb-1 p-0 text-footnote text-label-secondary uppercase">
                Email me about
              </legend>
              <GCheckbox
                v-for="p in PREFS"
                :key="p.k"
                :model-value="v[p.k]"
                :disabled="('fixed' in p && p.fixed) || locked"
                class="items-start py-2.5 [&>span:first-child]:mt-0.5"
                @update:model-value="setVal(p.k, $event === true)"
              >
                <span class="flex flex-col"
                  ><span class="font-semibold">{{ p.label }}</span
                  ><span
                    class="text-subhead text-label-secondary group-data-[disabled]:text-label-tertiary"
                    >{{ p.sub }}</span
                  ></span
                >
              </GCheckbox>
            </fieldset>
            <div class="w-px self-stretch bg-separator max-sm:hidden" />
            <fieldset class="m-0 flex min-w-0 flex-[1_1_240px] flex-col border-0 p-0">
              <legend class="mb-1 p-0 text-footnote text-label-secondary uppercase">
                Security
              </legend>
              <GSwitch
                v-for="s in SWITCHES"
                :key="s.k"
                :model-value="v[s.k]"
                :disabled="('fixed' in s && s.fixed) || locked"
                class="items-start rounded-lg py-2.5"
                @update:model-value="setVal(s.k, $event)"
              >
                <span class="flex flex-col"
                  ><span class="font-semibold">{{ s.label }}</span
                  ><span
                    class="text-subhead text-label-secondary group-data-[disabled]:text-label-tertiary"
                    >{{ s.sub }}</span
                  ></span
                >
              </GSwitch>
            </fieldset>
          </div>
          <div class="h-px bg-separator" />
          <GTextarea
            v-bind="field('notes')"
            :model-value="v.notes"
            :max="200"
            placeholder="Anything our team should know before your kickoff call"
            @update:model-value="onInput('notes', $event)"
            @blur="onBlur('notes')"
          />
          <div class="flex flex-col gap-1">
            <GCheckbox
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
                  class="text-negative"
                >
                  *</span
                ></span
              >
            </GCheckbox>
            <span
              id="f-terms-help"
              aria-live="polite"
              class="min-h-[18px] pl-[34px] text-footnote text-negative"
              >{{ termsInvalid ? result('terms').err : '' }}</span
            >
          </div>
        </article>

        <div class="flex flex-wrap items-center gap-3">
          <span
            role="status"
            :class="
              cn('mr-auto flex items-center gap-2 text-subhead font-semibold', footerStatus.cls)
            "
          >
            <component
              :is="footerStatus.icon"
              :size="16"
              aria-hidden="true"
              :class="submitting && 'animate-spin'"
            />{{ footerStatus.text }}
          </span>
          <GButton variant="gray" :disabled="inert" @click="draftSaved = !inert"
            >Save draft</GButton
          >
          <GButton
            type="submit"
            :loading="submitting"
            :disabled="locked || success"
            class="min-w-[190px]"
          >
            {{ submitting ? 'Creating…' : success ? 'Created' : 'Create workspace' }}
          </GButton>
        </div>
      </form>

      <GFormProgress
        :done="reqDone.length"
        :total="REQUIRED.length"
        :sections="sideSections"
        class="min-w-[260px] flex-[0_1_300px]"
      >
        <div class="h-px bg-separator" />
        <div class="flex flex-col gap-1">
          <span class="text-subhead font-semibold">Try it</span>
          <span class="text-subhead text-label-secondary">
            Use <span class="font-medium text-label">admin@…</span> to see a taken email,
            <span class="font-medium text-label">acme</span> for a taken URL, or a gmail address for
            a warning.
          </span>
        </div>
      </GFormProgress>
    </main>
  </div>
</template>
