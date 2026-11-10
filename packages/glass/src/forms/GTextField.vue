<script setup lang="ts">
import { CircleAlert, CircleCheck, Lock, TriangleAlert } from '@lucide/vue'
import { computed, useId } from 'vue'

import GLabel from '../components/GLabel.vue'
import GSpinner from '../components/GSpinner.vue'
import { cn } from '../lib/cn'
import { messageColor, wellClasses } from './fieldStyles'
import type { FieldStatus } from './types'

defineOptions({ inheritAttrs: false })

const {
  label,
  id: idProp,
  status = 'default',
  message,
  hint,
  required = false,
  optional = false,
  disabled = false,
  readonly = false,
  mono = false,
  class: className,
} = defineProps<{
  label: string
  id?: string
  /** Drives the ring, status icon, message colour and `aria-invalid` / `aria-busy`. */
  status?: FieldStatus
  /** Status message (error, warning, success or "Checking…"); replaces `hint` when set. */
  message?: string
  /** Helper text shown in the default state. */
  hint?: string
  required?: boolean
  optional?: boolean
  disabled?: boolean
  readonly?: boolean
  /** Fixed-width figures and a little tracking (card numbers, IDs). */
  mono?: boolean
  class?: string
}>()

const model = defineModel<string>({ default: '' })

const autoId = useId()
const id = computed(() => idProp ?? `g-text-${autoId}`)
const helpId = computed(() => `${id.value}-help`)
const help = computed(() => message ?? hint)
const tone = computed(() => (disabled ? 'disabled' : status))

const ICONS = { error: CircleAlert, warning: TriangleAlert, valid: CircleCheck } as const
const ICON_COLOR = {
  error: 'text-negative',
  warning: 'text-warning',
  valid: 'text-positive',
} as const
const statusIcon = computed(() =>
  disabled ? Lock : status in ICONS ? ICONS[status as keyof typeof ICONS] : undefined,
)
</script>

<template>
  <div data-slot="text-field" :class="cn('flex min-w-0 flex-col gap-1.5', className)">
    <div class="flex items-baseline justify-between gap-3">
      <GLabel :for="id" :required="required" :optional="optional" :disabled="disabled">{{
        label
      }}</GLabel>
      <slot name="label-aside" />
    </div>
    <div :class="wellClasses(status, disabled, readonly)">
      <slot name="prefix" />
      <span
        v-if="$slots.leading"
        aria-hidden="true"
        class="flex shrink-0 pl-3.5 text-label-secondary [&_svg]:size-[18px]"
      >
        <slot name="leading" />
      </span>
      <input
        :id="id"
        v-model="model"
        v-bind="$attrs"
        :disabled="disabled"
        :readonly="readonly"
        :aria-invalid="status === 'error' || undefined"
        :aria-busy="status === 'loading' || undefined"
        :aria-required="required || undefined"
        :aria-describedby="help ? helpId : undefined"
        :class="
          cn(
            'h-11 w-full min-w-0 flex-1 border-0 bg-transparent px-4 text-body text-inherit outline-none disabled:cursor-not-allowed',
            $slots.leading && 'pl-2.5',
            $slots.prefix && 'pl-0',
            mono && 'tracking-[0.04em] tabular-nums',
            readonly && 'cursor-default',
          )
        "
      />
      <GSpinner
        v-if="status === 'loading' && !disabled"
        :size="18"
        class="mr-3.5 text-label-secondary"
      />
      <component
        :is="statusIcon"
        v-else-if="statusIcon"
        :key="status"
        :size="disabled ? 16 : 18"
        aria-hidden="true"
        :class="
          cn(
            'mr-3.5 shrink-0 animate-g-pop-in',
            disabled ? 'text-label-secondary' : ICON_COLOR[status as keyof typeof ICON_COLOR],
          )
        "
      />
      <slot name="trailing" />
    </div>
    <span
      v-if="help"
      :id="helpId"
      aria-live="polite"
      :class="
        cn(
          'min-h-[18px] px-1 text-footnote [text-wrap:pretty] transition-colors duration-(--duration-normal)',
          messageColor[tone],
        )
      "
    >
      {{ help }}
    </span>
  </div>
</template>
