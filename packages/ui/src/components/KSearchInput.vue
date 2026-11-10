<script setup lang="ts">
import { Search, X } from '@lucide/vue'
import { useTemplateRef } from 'vue'

import { cn } from '../lib/cn'

// id, name, autocomplete, aria-describedby… belong on the <input>, not the wrapper.
defineOptions({ inheritAttrs: false })

const {
  label = 'Search',
  placeholder = 'Search anything…',
  clearLabel = 'Clear search',
  class: className,
} = defineProps<{
  /** Accessible name for the field. */
  label?: string
  placeholder?: string
  /** Accessible name of the clear button. */
  clearLabel?: string
  class?: string
}>()

const query = defineModel<string>({ default: '' })
const emit = defineEmits<{ submit: [query: string] }>()

const input = useTemplateRef<HTMLInputElement>('input')

function onEnter(event: KeyboardEvent) {
  // Enter also confirms an IME composition (Japanese, Chinese…); that isn't a search.
  if (event.isComposing) return
  emit('submit', query.value)
}

function clear() {
  query.value = ''
  // The clear button is about to hide; keep focus in the field.
  input.value?.focus()
}
</script>

<template>
  <!-- type="text" + inputmode="search": search keyboard on phones without the browser's own
       second clear button. -->
  <div
    role="search"
    data-slot="search-input"
    :class="
      cn(
        'group flex h-14 items-center gap-2 rounded-full border-[1.5px] border-line-control bg-surface-subtle pr-2 pl-5 shadow-recessed transition-[border-color,background-color,box-shadow] duration-(--duration-normal) ease-standard',
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
      ref="input"
      v-model="query"
      v-bind="$attrs"
      type="text"
      inputmode="search"
      enterkeyhint="search"
      :aria-label="label"
      :placeholder="placeholder"
      class="h-full min-w-0 flex-1 border-0 bg-transparent px-2 text-lg text-fg outline-hidden"
      @keydown.enter="onEnter"
    />
    <!-- `inert` while empty: out of the tab order and the accessibility tree, but still rendered
         so it can animate in and out. -->
    <button
      type="button"
      :aria-label="clearLabel"
      :inert="!query || undefined"
      :class="
        cn(
          'grid size-9 shrink-0 cursor-pointer place-items-center rounded-full border-0 bg-surface-recessed text-fg-muted transition-[opacity,scale,background-color] duration-(--duration-normal) ease-standard hover:bg-line',
          query ? 'scale-100 opacity-100' : 'pointer-events-none scale-60 opacity-0',
        )
      "
      @click="clear"
    >
      <X :size="16" aria-hidden="true" />
    </button>
    <template v-if="$slots.actions">
      <span aria-hidden="true" class="h-7 w-px shrink-0 bg-line" />
      <slot name="actions" />
    </template>
  </div>
</template>
