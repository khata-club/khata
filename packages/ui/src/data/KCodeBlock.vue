<script setup lang="ts">
import { Check, Copy } from '@lucide/vue'

import { cn } from '../lib/cn'
import { useCopy } from './useCopy'

const {
  code,
  language,
  title,
  class: className,
} = defineProps<{
  code: string
  /** Shown as a label, e.g. `bash`, `ts`, `json`. */
  language?: string
  title?: string
  class?: string
}>()

const { copied, copy } = useCopy()
</script>

<template>
  <figure
    data-slot="code-block"
    :class="cn('m-0 overflow-hidden rounded-lg border border-line bg-[#0f172a]', className)"
  >
    <figcaption
      class="flex items-center gap-2 border-b border-white/10 px-4 py-2 text-xs font-semibold text-white/70"
    >
      <span class="flex-1 truncate">{{ title ?? language ?? 'Code' }}</span>
      <span v-if="title && language" class="font-mono text-white/50">{{ language }}</span>
      <button
        type="button"
        :aria-label="copied ? 'Code copied' : 'Copy code'"
        class="grid size-7 cursor-pointer place-items-center rounded-md border-0 bg-transparent text-white/70 hover:bg-white/10 hover:text-white"
        @click="copy(code)"
      >
        <Check v-if="copied" :size="15" aria-hidden="true" />
        <Copy v-else :size="15" aria-hidden="true" />
      </button>
    </figcaption>
    <pre
      class="m-0 overflow-x-auto p-4 font-mono text-[13px] leading-relaxed text-[#e2e8f0]"
    ><code>{{ code }}</code></pre>
  </figure>
</template>
