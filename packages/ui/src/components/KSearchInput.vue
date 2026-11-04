<script setup lang="ts">
import { Search, X } from '@lucide/vue'

import { cn } from '../lib/cn'

const {
  label = 'Search',
  placeholder = 'Search anything…',
  class: className,
} = defineProps<{
  /** Accessible name for the field. */
  label?: string
  placeholder?: string
  class?: string
}>()

const query = defineModel<string>({ default: '' })
defineEmits<{ submit: [query: string] }>()
</script>

<template>
  <!-- type="text" + inputmode="search": search keyboard on phones without the browser's own
       second clear button. -->
  <div
    role="search"
    data-slot="search-input"
    :class="
      cn(
        'group flex h-14 items-center gap-2 rounded-full border-[1.5px] border-line bg-surface-subtle pr-2 pl-5 shadow-recessed transition-[border-color,background-color,box-shadow] duration-(--duration-normal) ease-standard',
        'focus-within:border-primary focus-within:bg-surface focus-within:shadow-recessed-focus',
        className,
      )
    "
  >
    <Search
      :size="22"
      aria-hidden="true"
      class="shrink-0 text-fg-muted transition-colors duration-(--duration-normal) group-focus-within:text-primary"
    />
    <input
      v-model="query"
      type="text"
      inputmode="search"
      enterkeyhint="search"
      :aria-label="label"
      :placeholder="placeholder"
      class="h-full min-w-0 flex-1 border-0 bg-transparent px-2 text-lg text-fg outline-none"
      @keydown.enter="$emit('submit', query)"
    />
    <button
      type="button"
      aria-label="Clear search"
      :tabindex="query ? 0 : -1"
      :class="
        cn(
          'grid size-9 shrink-0 cursor-pointer place-items-center rounded-full border-0 bg-surface-recessed text-fg-muted transition-[opacity,transform,background-color] duration-(--duration-normal) ease-standard hover:bg-gray-200',
          query ? 'scale-100 opacity-100' : 'pointer-events-none scale-60 opacity-0',
        )
      "
      @click="query = ''"
    >
      <X :size="16" aria-hidden="true" />
    </button>
    <template v-if="$slots.actions">
      <span aria-hidden="true" class="h-7 w-px shrink-0 bg-line" />
      <slot name="actions" />
    </template>
  </div>
</template>
