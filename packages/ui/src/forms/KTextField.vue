<script setup lang="ts">
import { CircleAlert, CircleCheck, Lock, TriangleAlert } from '@lucide/vue'
import { computed, useAttrs, useId } from 'vue'

import KLabel from '../components/KLabel.vue'
import KSpinner from '../components/KSpinner.vue'
import { cn } from '../lib/cn'
import { joinIds } from './aria'
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
  hideRequiredMark = false,
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
  /** Required for submission: sets `aria-required` and shows the asterisk. */
  required?: boolean
  /**
   * Keep `required` semantics but hide the asterisk, e.g. in forms that mark optional fields
   * instead of required ones.
   */
  hideRequiredMark?: boolean
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
const help = computed(() => message || hint)
// Keep the caller's own description (e.g. a format example) alongside ours.
const attrs = useAttrs()
const describedBy = computed(() =>
  joinIds(attrs['aria-describedby'], help.value ? helpId.value : undefined),
)
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
      <KLabel
        :for="id"
        :required="required && !hideRequiredMark"
        :optional="optional"
        :disabled="disabled"
        >{{ label }}</KLabel
      >
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
        :aria-describedby="describedBy"
        :class="
          cn(
            'h-[49px] w-full min-w-0 flex-1 border-0 bg-transparent px-4 text-base text-inherit outline-hidden disabled:cursor-not-allowed',
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
        class="mr-4 border-line border-t-current text-primary"
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
    <!-- Always mounted so the first message is announced; `empty:-mt-2` hides the gap. -->
    <span
      :id="helpId"
      aria-live="polite"
      :class="
        cn(
          'text-sm [text-wrap:pretty] transition-colors duration-(--duration-normal) empty:-mt-2',
          help && 'min-h-5',
          messageColor[tone],
        )
      "
      >{{ help }}</span
    >
  </div>
</template>
