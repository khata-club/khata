<script setup lang="ts">
import { Nfc } from '@lucide/vue'
import { computed } from 'vue'

import { cn } from '../lib/cn'
import { inkOn, mixToward, parseHex, toHex } from '../lib/color'

const DEFAULT_COLOR = '#1F3A5A'

const {
  color = DEFAULT_COLOR,
  bankName = 'Calm',
  tagline = 'Digital Bank',
  holder = '',
  number = '',
  expiry = '08/28',
  expiryLabel = 'Valid\nthru',
  network = 'Network',
  tier = 'Platinum',
  class: className,
} = defineProps<{
  /** Any hex (#rgb or #rrggbb). Ink, emboss and sheen adapt to its luminance. */
  color?: string
  bankName?: string
  tagline?: string
  /** Cardholder name (leave empty to hide it). */
  holder?: string
  /** Full or masked card number; the accessible name reads only the last 4 digits. */
  number?: string
  expiry?: string
  /** Use "\n" for a line break. */
  expiryLabel?: string
  /** Network wordmark (plain text placeholder; swap for your own branding). */
  network?: string
  tier?: string
  class?: string
}>()

const look = computed(() => {
  const rgb = parseHex(color) ?? parseHex(DEFAULT_COLOR)!
  const main = inkOn(rgb, 7, 0.85)
  const muted = inkOn(rgb, 4.5, 0.55)
  const light = main.light
  /** The card colour mixed toward white (255) or black (0) by `amount`, as an rgb() string. */
  const mix = (target: number, amount: number) => `rgb(${mixToward(rgb, target, amount).join(',')})`
  return {
    bg: `linear-gradient(160deg, ${mix(255, light ? 0.35 : 0.08)} 0%, ${toHex(rgb)} 45%, ${mix(0, light ? 0.06 : 0.22)} 100%)`,
    ink: `rgb(${main.ink.join(',')})`,
    inkMuted: `rgb(${muted.ink.join(',')})`,
    embossLight: light ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.14)',
    embossDark: light ? 'rgba(0,0,0,0.10)' : 'rgba(0,0,0,0.35)',
    rim: light
      ? 'inset 0 0 0 1px rgba(0,0,0,0.06), inset 0 1px 0 rgba(255,255,255,0.8)'
      : 'inset 0 0 0 1px rgba(255,255,255,0.06), inset 0 1px 0 rgba(255,255,255,0.12)',
  }
})
const last4 = computed(() => number.replace(/\D/g, '').slice(-4))
const accessibleName = computed(
  () =>
    `${tier} card` +
    (holder ? ` for ${holder}` : '') +
    (last4.value ? `, ending ${last4.value}` : ''),
)
const EMBOSS = [
  'M-2 120 C 18 112, 30 70, 50 32 L 104 138',
  'M-2 138 C 20 132, 32 92, 52 74 C 64 64, 76 90, 104 150',
]
</script>

<template>
  <!-- Fills its container's width; all sizes are container-relative (cqw) so it scales cleanly. -->
  <div data-slot="credit-card" :class="cn('@container w-full font-sans', className)">
    <div
      role="img"
      :aria-label="accessibleName"
      class="relative isolate aspect-[54/85.6] w-full overflow-hidden rounded-[5.5cqw] shadow-[0_1px_2px_rgba(15,27,45,0.12),0_12px_28px_-8px_rgba(15,27,45,0.35)]"
      :style="{ background: look.bg, color: look.ink }"
    >
      <svg
        viewBox="0 0 100 158.5"
        preserveAspectRatio="none"
        aria-hidden="true"
        class="absolute inset-0 z-0 size-full"
      >
        <template v-for="d in EMBOSS" :key="d">
          <path
            :d="d"
            fill="none"
            :stroke="look.embossDark"
            stroke-width="0.5"
            transform="translate(0.35 0.45)"
          />
          <path :d="d" fill="none" :stroke="look.embossLight" stroke-width="0.5" />
        </template>
      </svg>
      <div class="absolute inset-0 z-1 flex flex-col px-[8.5cqw] pt-[9cqw] pb-[8cqw]">
        <div class="flex items-start justify-between gap-[4cqw]">
          <div class="flex min-w-0 flex-col gap-[1.6cqw]">
            <span
              class="text-[10.5cqw] leading-none font-normal tracking-[0.08em] whitespace-nowrap uppercase"
              >{{ bankName }}</span
            >
            <span
              class="text-[3cqw] leading-none font-medium tracking-[0.18em] uppercase"
              :style="{ color: look.inkMuted }"
              >{{ tagline }}</span
            >
          </div>
          <div class="flex flex-none items-center gap-[4cqw]" aria-hidden="true">
            <!-- EMV chip -->
            <div
              class="relative h-[16cqw] w-[13cqw] overflow-hidden rounded-[2.4cqw] bg-[linear-gradient(140deg,#e9e9ea_0%,#b9babd_45%,#d8d9db_70%,#a7a8ab_100%)] shadow-[inset_0_0_0_0.3cqw_rgba(0,0,0,.18),0_0.4cqw_0.8cqw_rgba(0,0,0,.18)]"
            >
              <div class="absolute inset-x-0 top-[33%] h-[0.3cqw] bg-black/22" />
              <div class="absolute inset-x-0 top-[66%] h-[0.3cqw] bg-black/22" />
              <div class="absolute inset-y-0 left-1/2 w-[0.3cqw] bg-black/22" />
              <div
                class="absolute inset-x-[30%] inset-y-[28%] rounded-[1.4cqw] bg-[linear-gradient(140deg,#dcdddf,#b3b4b7)] shadow-[inset_0_0_0_0.3cqw_rgba(0,0,0,.22)]"
              />
            </div>
            <Nfc class="size-[7cqw]" :style="{ color: look.inkMuted }" />
          </div>
        </div>
        <div class="flex-1" />
        <div class="flex flex-col gap-[3.6cqw]">
          <span
            class="truncate text-[4.4cqw] leading-none font-semibold tracking-[0.14em] uppercase"
            >{{ holder }}</span
          >
          <span class="font-mono text-[6.6cqw] leading-none tracking-[0.04em] whitespace-nowrap">{{
            number
          }}</span>
        </div>
        <div class="mt-[7cqw] flex items-end justify-between gap-[4cqw]">
          <div class="flex items-center gap-[3cqw]">
            <span
              class="text-[2.6cqw] leading-[1.15] font-semibold tracking-[0.1em] whitespace-pre-line uppercase"
              :style="{ color: look.inkMuted }"
              >{{ expiryLabel }}</span
            >
            <span class="font-mono text-[5cqw] leading-none">{{ expiry }}</span>
          </div>
          <div class="flex flex-col items-end gap-[1.4cqw]">
            <span class="text-[8cqw] leading-none font-bold tracking-[0.02em] uppercase italic">{{
              network
            }}</span>
            <span
              class="text-[3.6cqw] leading-none font-medium tracking-[0.04em]"
              :style="{ color: look.inkMuted }"
              >{{ tier }}</span
            >
          </div>
        </div>
      </div>
      <div
        aria-hidden="true"
        class="pointer-events-none absolute inset-0 z-2 rounded-[inherit] bg-[linear-gradient(115deg,rgba(255,255,255,0.10)_0%,rgba(255,255,255,0)_38%,rgba(255,255,255,0)_70%,rgba(255,255,255,0.05)_100%)]"
        :style="{ boxShadow: look.rim }"
      />
    </div>
  </div>
</template>
