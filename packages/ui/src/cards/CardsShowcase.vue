<script setup lang="ts">
import { ArrowLeft } from '@lucide/vue'
import { computed, ref } from 'vue'

import { parseHex, toHex } from '../lib/color'
import KCreditCard from './KCreditCard.vue'

const { initialColor = '#7A5C2E' } = defineProps<{ initialColor?: string }>()

const hex = ref(initialColor.toUpperCase())
const draft = ref(hex.value)
const PRESETS = [
  ['#1F3A5A', 'Platinum'],
  ['#4A1520', 'Signature'],
  ['#EFEBE4', 'Infinite'],
  ['#2F4A3A', 'Classic'],
  ['#17181B', 'Black'],
  ['#C9A86A', 'Gold'],
  ['#8FA7C4', 'Standard'],
  ['#D9622B', 'Student'],
] as const

function set(v: string) {
  const rgb = parseHex(v)
  if (rgb) hex.value = toHex(rgb)
}
function onDraft(v: string) {
  draft.value = v
  set(v)
}
function use(c: string) {
  hex.value = c
  draft.value = c
}
const pickerVal = computed(() => hex.value.toLowerCase())
</script>

<template>
  <div class="min-h-screen bg-canvas font-sans text-fg">
    <header class="mx-auto flex max-w-[1180px] flex-col gap-6 px-6 pt-12 pb-8">
      <a
        href="#"
        class="inline-flex items-center gap-2 self-start text-sm font-semibold text-primary no-underline hover:text-primary-pressed"
      >
        <ArrowLeft :size="16" aria-hidden="true" />Component library
      </a>
      <div class="flex flex-wrap items-end justify-between gap-6 border-b border-line pb-5">
        <div class="flex flex-col gap-1">
          <span class="font-mono text-xs text-fg-muted">Level 04 · Components</span>
          <h1 class="m-0 text-3xl font-semibold">Credit card</h1>
          <p class="mt-1 mb-0 max-w-[520px] text-base [text-wrap:pretty] text-fg-muted">
            A vertical card template. Pass any hex as <code class="font-mono">color</code>; ink,
            emboss and sheen adapt to the background's luminance.
          </p>
        </div>
        <div class="flex flex-col gap-2">
          <label for="hex" class="text-xs font-semibold tracking-label text-fg-muted uppercase"
            >Custom color</label
          >
          <div
            class="flex h-11 items-center gap-2 rounded-full border border-line-control bg-surface-subtle px-1.5 pr-4 shadow-recessed focus-within:border-primary focus-within:shadow-recessed-focus"
          >
            <input
              type="color"
              :value="pickerVal"
              aria-label="Pick color"
              class="size-8 cursor-pointer rounded-full border-0 bg-transparent p-0"
              @input="(set(($event.target as HTMLInputElement).value), (draft = hex))"
            />
            <input
              id="hex"
              :value="draft"
              spellcheck="false"
              autocomplete="off"
              class="w-24 border-0 bg-transparent font-mono text-sm text-fg uppercase outline-none"
              @input="onDraft(($event.target as HTMLInputElement).value)"
            />
          </div>
        </div>
      </div>
    </header>
    <main class="mx-auto flex max-w-[1180px] flex-col gap-12 px-6 pb-16">
      <section class="flex flex-col gap-5">
        <h2 class="m-0 text-xl font-semibold">Custom</h2>
        <div class="flex flex-wrap items-start gap-8">
          <div class="w-[280px] max-w-full"><KCreditCard :color="hex" tier="Custom" /></div>
          <div class="flex max-w-[420px] flex-col gap-2 text-sm text-fg-muted">
            <span class="font-mono text-xs text-fg">&lt;KCreditCard color="{{ hex }}" /&gt;</span>
            <span>
              Props: color, bankName, tagline, holder, number, expiry, expiryLabel, network, tier.
              The card fills its container width and keeps the ISO 54 × 85.6 ratio.
            </span>
          </div>
        </div>
      </section>
      <section class="flex flex-col gap-5">
        <h2 class="m-0 text-xl font-semibold">Presets</h2>
        <div class="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-8">
          <div v-for="[c, tier] in PRESETS" :key="c" class="flex flex-col gap-3">
            <KCreditCard :color="c" :tier="tier" />
            <button
              type="button"
              :aria-label="`Use ${tier} color ${c}`"
              class="cursor-pointer self-start border-0 bg-transparent p-0 font-mono text-xs text-fg-muted hover:text-primary"
              @click="use(c)"
            >
              {{ c }}
            </button>
          </div>
        </div>
      </section>
    </main>
  </div>
</template>
