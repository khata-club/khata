<script setup lang="ts">
import { cn } from '../lib/cn'

const {
  header,
  footer,
  class: className,
} = defineProps<{
  /** Small caption above the group. */
  header?: string
  /** Explanatory text below the group. */
  footer?: string
  class?: string
}>()
</script>

<template>
  <!-- An inset-grouped list: rows share one rounded surface, separated by inset hairlines. -->
  <section data-slot="list-section" :class="cn('flex flex-col gap-1.5', className)">
    <h3 v-if="header" class="m-0 px-4 text-footnote font-normal text-label-secondary uppercase">
      {{ header }}
    </h3>
    <div
      role="list"
      class="flex flex-col overflow-hidden rounded-xl bg-surface [&>*]:relative [&>*+*]:before:absolute [&>*+*]:before:inset-x-0 [&>*+*]:before:top-0 [&>*+*]:before:ml-4 [&>*+*]:before:h-px [&>*+*]:before:bg-separator [&>*+*]:before:content-[''] [&>*+[data-icon]]:before:ml-[58px]"
    >
      <slot />
    </div>
    <p v-if="footer || $slots.footer" class="m-0 px-4 text-footnote text-label-secondary">
      <slot name="footer">{{ footer }}</slot>
    </p>
  </section>
</template>
