<script setup lang="ts">
import { parseHex, toHex } from '@khata/ui'
import { computed, ref } from 'vue'

import GCreditCard from './GCreditCard.vue'

const { initialColor = '#7A5C2E' } = defineProps<{ initialColor?: string }>()

const hex = ref(initialColor.toUpperCase())
const draft = ref(hex.value)
const PRESETS = [
  ['#1C1C1E', 'Black'],
  ['#1F3A5A', 'Platinum'],
  ['#4A1520', 'Signature'],
  ['#2F4A3A', 'Classic'],
  ['#C9A86A', 'Gold'],
  ['#8FA7C4', 'Standard'],
  ['#D9622B', 'Student'],
  ['#EFEBE4', 'Infinite'],
] as const

function set(v: string) {
  const rgb = parseHex(v)
  if (rgb) hex.value = toHex(rgb)
}
function onDraft(v: string) {
  draft.value = v
  set(v)
}
const picked = ref<number | null>(null)
const pickerVal = computed(() => hex.value.toLowerCase())
</script>

<template>
  <div class="-m-8 min-h-screen bg-canvas font-sans text-label">
    <header class="mx-auto flex max-w-[1180px] flex-col gap-5 px-6 pt-12 pb-8">
      <div class="flex flex-wrap items-end justify-between gap-6">
        <div class="flex flex-col gap-1">
          <span class="text-footnote text-label-secondary uppercase">Components</span>
          <h1 class="m-0 text-large-title font-bold">Credit card</h1>
          <p class="mt-1 mb-0 max-w-[520px] text-body [text-wrap:pretty] text-label-secondary">
            A Wallet-style card. Pass any hex as <code>color</code>; ink and sheen adapt to its
            luminance. Move the pointer over a card to tilt it.
          </p>
        </div>
        <div class="flex flex-col gap-1.5">
          <label for="hex" class="text-subhead font-medium">Custom colour</label>
          <div
            class="flex h-11 items-center gap-2 rounded-full bg-fill-tertiary pr-4 pl-1.5 focus-within:shadow-[0_0_0_1px_var(--color-tint),0_0_0_4px_var(--color-accent-soft)]"
          >
            <input
              type="color"
              :value="pickerVal"
              aria-label="Pick colour"
              class="size-8 cursor-pointer rounded-full border-0 bg-transparent p-0"
              @input="(set(($event.target as HTMLInputElement).value), (draft = hex))"
            />
            <input
              id="hex"
              :value="draft"
              spellcheck="false"
              autocomplete="off"
              class="w-24 border-0 bg-transparent text-body text-label uppercase tabular-nums outline-none"
              @input="onDraft(($event.target as HTMLInputElement).value)"
            />
          </div>
        </div>
      </div>
    </header>
    <main class="mx-auto flex max-w-[1180px] flex-wrap items-start gap-12 px-6 pb-16">
      <section class="flex w-[340px] max-w-full flex-col gap-4">
        <h2 class="m-0 text-title-2 font-bold">Custom</h2>
        <GCreditCard :color="hex" tier="Custom" />
        <span class="text-footnote text-label-secondary">
          Props: color, bankName, tagline, holder, number, showNumber, expiry, network, tier, tilt.
          The card fills its container and keeps the ISO 85.6 × 54 ratio.
        </span>
      </section>
      <section class="flex w-[340px] max-w-full flex-col gap-4">
        <h2 class="m-0 text-title-2 font-bold">Wallet</h2>
        <!-- A stack like Wallet: each card tucks under the next; the chosen one springs up. -->
        <div class="flex flex-col pb-[46%]">
          <button
            v-for="([c, tier], i) in PRESETS"
            :key="c"
            type="button"
            :aria-label="`${tier} card, ${c}`"
            :aria-pressed="picked === i"
            class="relative -mb-[50%] cursor-pointer border-0 bg-transparent p-0 text-left transition-[translate] duration-(--duration-spring) ease-bouncy hover:-translate-y-3"
            :class="picked === i && '-translate-y-[34%] hover:-translate-y-[34%]'"
            @click="picked = picked === i ? null : i"
          >
            <GCreditCard :color="c" :tier="tier" :tilt="false" />
          </button>
        </div>
      </section>
    </main>
  </div>
</template>
