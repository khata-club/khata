<script setup lang="ts">
import { RadioGroupItem, RadioGroupRoot } from 'reka-ui'
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

function update(v: unknown) {
  if (!readonly) value.value = v as string
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
  <!-- Radio semantics: one Tab stop, arrow keys move and select. Tiles sit on the surface; the
       chosen one gains an accent ring and a check that springs in. -->
  <RadioGroupRoot
    :model-value="value"
    :aria-label="label"
    :aria-invalid="invalid || undefined"
    :disabled="disabled"
    :required="true"
    loop
    data-slot="choice-cards"
    :class="
      cn(
        'grid grid-cols-[repeat(auto-fit,minmax(min(100%,140px),1fr))] gap-2.5',
        shaking && 'animate-g-shake',
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
          'group relative flex cursor-pointer flex-col items-start gap-0.5 rounded-lg border-0 bg-surface p-4 pr-10 text-left text-label shadow-[inset_0_0_0_1px_var(--color-separator)]',
          'transition-[box-shadow,scale,background-color] duration-(--duration-spring) ease-bouncy active:scale-[0.98] active:duration-(--duration-fast)',
          'data-[invalid]:shadow-[inset_0_0_0_1.5px_var(--color-negative)]',
          'data-[state=checked]:shadow-[inset_0_0_0_2px_var(--color-tint)]',
          readonly && 'cursor-default active:scale-100',
          'data-[disabled]:cursor-not-allowed data-[disabled]:opacity-40 data-[disabled]:active:scale-100',
        )
      "
    >
      <span
        aria-hidden="true"
        class="absolute top-3.5 right-3.5 grid size-[22px] place-items-center rounded-full shadow-[inset_0_0_0_1.5px_var(--color-control)] transition-[background-color,box-shadow] duration-(--duration-normal) group-data-[state=checked]:bg-accent group-data-[state=checked]:shadow-none"
      >
        <svg
          viewBox="0 0 24 24"
          class="size-3.5 scale-0 fill-none stroke-white stroke-[3.5] transition-[scale] duration-(--duration-spring) ease-bouncy group-data-[state=checked]:scale-100"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path d="M5 12.5 10 17.5 19 7" />
        </svg>
      </span>
      <span class="text-body font-semibold">{{ o.label }}</span>
      <span v-if="o.description" class="text-footnote text-label-secondary">
        {{ o.description }}
      </span>
    </RadioGroupItem>
  </RadioGroupRoot>
</template>
