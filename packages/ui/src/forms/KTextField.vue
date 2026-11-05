<script setup lang="ts">
import { CircleAlert, CircleCheck, Lock, TriangleAlert } from '@lucide/vue'
import { computed, useId } from 'vue'

import KLabel from '../components/KLabel.vue'
import KSpinner from '../components/KSpinner.vue'
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
  /** Drives border, status icon, message colour and `aria-invalid` / `aria-busy`. */
  status?: FieldStatus
  /** Status message (error, warning, success or "Checking…"); replaces `hint` when set. */
  message?: string
  /** Helper text shown in the default state. */
  hint?: string
  required?: boolean
  optional?: boolean
  disabled?: boolean
  readonly?: boolean
  /** Monospace value (card numbers, IDs). */
  mono?: boolean
  class?: string
}>()

const model = defineModel<string>({ default: '' })

const autoId = useId()
const id = computed(() => idProp ?? `k-text-${autoId}`)
const helpId = computed(() => `${id.value}-help`)
const help = computed(() => message ?? hint)
const tone = computed(() => (disabled ? 'disabled' : status))

const ICONS = { error: CircleAlert, warning: TriangleAlert, valid: CircleCheck } as const
const ICON_COLOR = { error: 'text-danger', warning: 'text-warning', valid: 'text-success' } as const
const statusIcon = computed(() =>
  disabled ? Lock : status in ICONS ? ICONS[status as keyof typeof ICONS] : undefined,
)
</script>

<template>
  <div data-slot="text-field" :class="cn('flex min-w-0 flex-col gap-2', className)">
    <div class="flex items-baseline justify-between gap-3">
      <KLabel :for="id" :required="required" :optional="optional" :disabled="disabled">{{
        label
      }}</KLabel>
      <slot name="label-aside" />
    </div>
    <div :class="wellClasses(status, disabled, readonly)">
      <slot name="prefix" />
      <span
        v-if="$slots.leading"
        aria-hidden="true"
        class="flex shrink-0 pl-4 text-fg-muted [&_svg]:size-5"
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
            'h-[49px] w-full min-w-0 flex-1 border-0 bg-transparent px-4 text-base text-inherit outline-none disabled:cursor-not-allowed',
            $slots.leading && 'pl-3',
            $slots.prefix && 'pl-0',
            mono && 'font-mono tracking-[0.04em]',
            mono && readonly && 'text-sm tracking-normal',
            readonly && 'cursor-default',
          )
        "
      />
      <KSpinner
        v-if="status === 'loading' && !disabled"
        class="mr-4 border-gray-200 border-t-current text-primary"
      />
      <component
        :is="statusIcon"
        v-else-if="statusIcon"
        :size="disabled ? 18 : 20"
        aria-hidden="true"
        :class="
          cn(
            'mr-4 shrink-0 animate-ck-pop-in',
            disabled ? 'text-fg-disabled' : ICON_COLOR[status as keyof typeof ICON_COLOR],
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
          'min-h-5 text-sm [text-wrap:pretty] transition-colors duration-(--duration-normal)',
          messageColor[tone],
        )
      "
    >
      {{ help }}
    </span>
  </div>
</template>
