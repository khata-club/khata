<script setup lang="ts" generic="Row extends Record<string, unknown>">
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight } from '@lucide/vue'
import { computed } from 'vue'

import { cn } from '../lib/cn'

export interface DataTableColumn<R> {
  key: keyof R & string
  label: string
  sortable?: boolean
  align?: 'left' | 'right'
  /** Tailwind width/visibility classes, e.g. `w-40 max-md:hidden`. */
  class?: string
}

export interface DataTableSort {
  key: string
  direction: 'asc' | 'desc'
}

const {
  columns,
  rows,
  rowKey,
  caption,
  loading = false,
  hasPrevious = false,
  hasNext = false,
  clickable = false,
  class: className,
} = defineProps<{
  columns: DataTableColumn<Row>[]
  rows: Row[]
  /** Property holding a stable unique ID per row. */
  rowKey: keyof Row & string
  /** Accessible table caption (visually hidden). */
  caption: string
  loading?: boolean
  /** Cursor pagination: whether earlier/later pages exist. */
  hasPrevious?: boolean
  hasNext?: boolean
  /** Rows emit `row-click` and are keyboard-activatable. */
  clickable?: boolean
  class?: string
}>()

const sort = defineModel<DataTableSort | undefined>('sort')

const emit = defineEmits<{
  'row-click': [row: Row]
  previous: []
  next: []
}>()

const showPager = computed(() => hasPrevious || hasNext)

function toggleSort(key: string) {
  sort.value =
    sort.value?.key === key && sort.value.direction === 'asc'
      ? { key, direction: 'desc' }
      : { key, direction: 'asc' }
}

function ariaSort(key: string) {
  if (sort.value?.key !== key) return 'none'
  return sort.value.direction === 'asc' ? 'ascending' : 'descending'
}
</script>

<template>
  <div
    data-slot="data-table"
    :class="cn('overflow-hidden rounded-lg border border-line bg-surface', className)"
  >
    <div class="overflow-x-auto">
      <table class="w-full border-collapse text-sm" :aria-busy="loading">
        <caption class="sr-only">
          {{
            caption
          }}
        </caption>
        <thead class="bg-surface-subtle">
          <tr>
            <th
              v-for="c in columns"
              :key="c.key"
              scope="col"
              :aria-sort="c.sortable ? ariaSort(c.key) : undefined"
              :class="
                cn(
                  'border-b border-line px-4 py-2.5 text-xs font-semibold tracking-wide whitespace-nowrap text-fg-muted uppercase',
                  c.align === 'right' ? 'text-right' : 'text-left',
                  c.class,
                )
              "
            >
              <button
                v-if="c.sortable"
                type="button"
                class="inline-flex cursor-pointer items-center gap-1 border-0 bg-transparent p-0 font-[inherit] tracking-[inherit] text-inherit uppercase hover:text-fg"
                @click="toggleSort(c.key)"
              >
                {{ c.label }}
                <ArrowUp v-if="ariaSort(c.key) === 'ascending'" :size="14" aria-hidden="true" />
                <ArrowDown
                  v-else-if="ariaSort(c.key) === 'descending'"
                  :size="14"
                  aria-hidden="true"
                />
                <ArrowUpDown v-else :size="14" aria-hidden="true" class="opacity-50" />
              </button>
              <template v-else>{{ c.label }}</template>
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="loading && rows.length === 0">
            <td :colspan="columns.length" class="px-4 py-10 text-center text-fg-muted">Loading…</td>
          </tr>
          <tr v-else-if="rows.length === 0">
            <td :colspan="columns.length" class="p-0">
              <slot name="empty">
                <p class="px-4 py-10 text-center text-fg-muted">Nothing here yet.</p>
              </slot>
            </td>
          </tr>
          <tr
            v-for="row in rows"
            :key="String(row[rowKey])"
            :tabindex="clickable ? 0 : undefined"
            :class="
              cn(
                'border-b border-line last:border-b-0',
                clickable &&
                  'cursor-pointer outline-none hover:bg-surface-subtle focus-visible:bg-primary-subtle',
              )
            "
            @click="clickable && emit('row-click', row)"
            @keydown.enter="clickable && emit('row-click', row)"
          >
            <td
              v-for="c in columns"
              :key="c.key"
              :class="
                cn(
                  'px-4 py-3 align-middle',
                  c.align === 'right' && 'text-right tabular-nums',
                  c.class,
                )
              "
            >
              <slot :name="`cell-${c.key}`" :row="row" :value="row[c.key]">
                {{ row[c.key] ?? '—' }}
              </slot>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <div
      v-if="showPager"
      class="flex items-center justify-end gap-2 border-t border-line px-3 py-2"
    >
      <button
        type="button"
        :disabled="!hasPrevious || loading"
        aria-label="Previous page"
        class="grid size-9 cursor-pointer place-items-center rounded-md border border-line bg-surface text-fg-muted hover:text-fg disabled:cursor-not-allowed disabled:opacity-40"
        @click="emit('previous')"
      >
        <ChevronLeft :size="18" aria-hidden="true" />
      </button>
      <button
        type="button"
        :disabled="!hasNext || loading"
        aria-label="Next page"
        class="grid size-9 cursor-pointer place-items-center rounded-md border border-line bg-surface text-fg-muted hover:text-fg disabled:cursor-not-allowed disabled:opacity-40"
        @click="emit('next')"
      >
        <ChevronRight :size="18" aria-hidden="true" />
      </button>
    </div>
  </div>
</template>
