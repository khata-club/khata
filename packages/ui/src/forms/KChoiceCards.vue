<script setup lang="ts">
import { RadioGroupItem, RadioGroupRoot, type AcceptableValue } from 'reka-ui'
import { ref, watch } from 'vue'

import { cn } from '../lib/cn'

export interface ChoiceCard {
  value: string
  label: string
  description?: string
  disabled?: boolean
}

const {
  options,
  label,
  invalid = false,
  required = false,
  disabled = false,
  readonly = false,
  shakeKey = 0,
  idPrefix,
  class: className,
} = defineProps<{
  options: ChoiceCard[]
  /** Accessible name for the group. */
  label: string
  invalid?: boolean
  /** A choice must be made before submitting (`aria-required`). */
  required?: boolean
  disabled?: boolean
  /** Shows the value but ignores changes (e.g. while submitting). */
  readonly?: boolean
  /** Change this number to replay the "nudge" shake (e.g. on a failed submit). */
  shakeKey?: number
  /** Gives each card an id (`${idPrefix}-${index}`) so an error summary can focus it. */
  idPrefix?: string
  class?: string
}>()

const value = defineModel<string>()

const shaking = ref(false)
watch(
  () => shakeKey,
  () => {
    if (!invalid) return
    shaking.value = false
    requestAnimationFrame(() => (shaking.value = true))
  },
)

function update(v: AcceptableValue) {
  if (!readonly && typeof v === 'string') value.value = v
}

// Like native radios, arrow keys select the newly focused card, even when nothing was
// selected yet (Reka only moves focus in that case).
const ARROWS = ['ArrowRight', 'ArrowLeft', 'ArrowDown', 'ArrowUp']
function onKeydown(e: KeyboardEvent) {
  if (!ARROWS.includes(e.key) || readonly) return
  requestAnimationFrame(() => {
    const v = (document.activeElement as HTMLElement | null)?.dataset.choiceValue
    if (v && v !== value.value) value.value = v
  })
}
</script>

<template>
  <!-- Radio semantics: one Tab stop, arrow keys move and select. -->
  <RadioGroupRoot
    :model-value="value"
    :aria-label="label"
    :aria-invalid="invalid || undefined"
    :disabled="disabled"
    :required="required"
    loop
    data-slot="choice-cards"
    :class="
      cn(
        'grid grid-cols-[repeat(auto-fit,minmax(min(100%,140px),1fr))] gap-3 rounded-lg',
        shaking && 'animate-ck-shake',
        className,
      )
    "
    @update:model-value="update"
    @animationend="shaking = false"
    @keydown="onKeydown"
  >
    <RadioGroupItem
      v-for="(o, i) in options"
      :id="idPrefix ? `${idPrefix}-${i}` : undefined"
      :key="o.value"
      :value="o.value"
      :data-choice-value="o.value"
      :disabled="o.disabled"
      :data-invalid="invalid || undefined"
      :class="
        cn(
          'group flex cursor-pointer items-start gap-3 rounded-lg border-[1.5px] border-line bg-surface p-4 text-left text-fg shadow-raised-sm outline-hidden transition-[border-color,background-color,box-shadow,translate] duration-(--duration-normal) ease-standard',
          'focus-visible:shadow-raised-sm-focus data-[invalid]:border-danger',
          'data-[state=checked]:-translate-y-px data-[state=checked]:border-primary data-[state=checked]:bg-primary-subtle',
          readonly && 'cursor-default data-[state=checked]:translate-y-0',
          'data-[disabled]:translate-y-0 data-[disabled]:cursor-not-allowed data-[disabled]:border-dashed data-[disabled]:border-line-control data-[disabled]:bg-surface-recessed data-[disabled]:text-fg-disabled data-[disabled]:shadow-none',
        )
      "
    >
      <span
        class="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full border-[1.5px] border-line-control transition-colors duration-(--duration-normal) group-data-[disabled]:border-line-control group-data-[invalid]:border-danger group-data-[state=checked]:border-primary"
      >
        <span
          class="size-2.5 scale-0 rounded-full bg-primary transition-transform duration-(--duration-slow) ease-standard group-data-[state=checked]:scale-100"
        />
      </span>
      <span class="flex flex-col">
        <span class="text-base font-semibold">{{ o.label }}</span>
        <span
          v-if="o.description"
          class="text-sm text-fg-muted group-data-[disabled]:text-fg-disabled group-data-[state=checked]:text-primary-pressed"
        >
          {{ o.description }}
        </span>
      </span>
    </RadioGroupItem>
  </RadioGroupRoot>
</template>
