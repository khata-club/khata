<script setup lang="ts">
import { Search, X } from '@lucide/vue'

import { cn } from '../lib/cn'

const {
  label = 'Search',
  placeholder = 'Search',
  variant = 'filled',
  class: className,
} = defineProps<{
  /** Accessible name for the field. */
  label?: string
  placeholder?: string
  /** `glass` when the field floats over content (e.g. in a toolbar). */
  variant?: 'filled' | 'glass'
  class?: string
}>()

const query = defineModel<string>({ default: '' })
defineEmits<{ submit: [query: string] }>()
</script>

<template>
  <!-- type="text" + inputmode="search": a search keyboard on phones without the browser's own
       second clear button. -->
  <div
    role="search"
    data-slot="search-input"
    :class="
      cn(
        'group flex h-11 items-center gap-2 rounded-full pr-1.5 pl-3.5 transition-[background-color,box-shadow] duration-(--duration-normal) ease-out',
        variant === 'glass' ? 'glass-thin' : 'bg-fill-tertiary',
        'focus-within:shadow-[0_0_0_1px_var(--color-tint),0_0_0_4px_var(--color-accent-soft)]',
        className,
      )
    "
  >
    <Search
      :size="18"
      :stroke-width="2.25"
      aria-hidden="true"
      class="shrink-0 text-label-secondary"
    />
    <input
      v-model="query"
      type="text"
      inputmode="search"
      enterkeyhint="search"
      :aria-label="label"
      :placeholder="placeholder"
      class="h-full min-w-0 flex-1 border-0 bg-transparent text-body text-label outline-none"
      @keydown.enter="$emit('submit', query)"
    />
    <button
      type="button"
      aria-label="Clear search"
      :tabindex="query ? 0 : -1"
      :class="
        cn(
          'grid size-8 shrink-0 cursor-pointer place-items-center rounded-full border-0 bg-transparent transition-[opacity,scale] duration-(--duration-spring) ease-bouncy',
          query ? 'scale-100 opacity-100' : 'pointer-events-none scale-50 opacity-0',
        )
      "
      @click="query = ''"
    >
      <span class="grid size-[18px] place-items-center rounded-full bg-label-tertiary text-surface">
        <X :size="12" :stroke-width="3" aria-hidden="true" />
      </span>
    </button>
    <template v-if="$slots.actions">
      <span aria-hidden="true" class="h-6 w-px shrink-0 bg-separator" />
      <slot name="actions" />
    </template>
  </div>
</template>
