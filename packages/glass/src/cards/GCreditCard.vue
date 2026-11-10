<script setup lang="ts">
import { inkOn, parseHex, prefersReducedMotion, toHex } from '@khata/ui'
import { Nfc } from '@lucide/vue'
import { computed, ref } from 'vue'

import { cn } from '../lib/cn'

const {
  color = '#1C1C1E',
  bankName = 'khata',
  tagline = 'Card',
  holder = 'Diego van Dijk',
  number = '4000 1234 5678 9010',
  showNumber = false,
  expiry = '08/28',
  network = 'Network',
  tier = 'Platinum',
  tilt = true,
  class: className,
} = defineProps<{
  /** Any hex (#rgb or #rrggbb). Ink and sheen adapt to its luminance. */
  color?: string
  bankName?: string
  tagline?: string
  holder?: string
  number?: string
  /** Print the full number; by default only the last four digits show, as in Wallet. */
  showNumber?: boolean
  expiry?: string
  /** Network wordmark (plain text placeholder; swap for your own branding). */
  network?: string
  tier?: string
  /** Lean toward the pointer with a moving sheen. Off under reduced motion. */
  tilt?: boolean
  class?: string
}>()

type RGB = [number, number, number]
const mix = (c: RGB, t: number, a: number): RGB => c.map((v) => Math.round(v + (t - v) * a)) as RGB

const look = computed(() => {
  const rgb = (parseHex(color) ?? parseHex('#1C1C1E')!) as RGB
  const main = inkOn(rgb, 7, 0.85)
  const muted = inkOn(rgb, 4.5, 0.55)
  const light = main.light
  const rgba = (t: number, a: number) => `rgb(${mix(rgb, t, a).join(',')})`
  return {
    bg: `linear-gradient(150deg, ${rgba(255, light ? 0.28 : 0.12)} 0%, ${toHex(rgb)} 50%, ${rgba(0, light ? 0.06 : 0.25)} 100%)`,
    ink: `rgb(${main.ink.join(',')})`,
    inkMuted: `rgb(${muted.ink.join(',')})`,
    sheen: light ? 0.55 : 0.22,
  }
})
const last4 = computed(() => number.replace(/\D/g, '').slice(-4))

// Pointer tilt: a few degrees of lean and a sheen that follows the pointer; leaving springs back.
const pose = ref({ rx: 0, ry: 0, sx: 30, sy: 0, active: false })
function onMove(e: PointerEvent) {
  if (!tilt || e.pointerType === 'touch' || prefersReducedMotion()) return
  const r = (e.currentTarget as HTMLElement).getBoundingClientRect()
  const px = (e.clientX - r.left) / r.width
  const py = (e.clientY - r.top) / r.height
  pose.value = { rx: (0.5 - py) * 8, ry: (px - 0.5) * 10, sx: px * 100, sy: py * 100, active: true }
}
function onLeave() {
  pose.value = { rx: 0, ry: 0, sx: 30, sy: 0, active: false }
}
</script>

<template>
  <!-- Fills its container's width; sizes are container-relative (cqw) so it scales cleanly. -->
  <div
    data-slot="credit-card"
    :class="cn('@container w-full font-sans [perspective:1000px]', className)"
    @pointermove="onMove"
    @pointerleave="onLeave"
  >
    <div
      role="img"
      :aria-label="`${tier} card for ${holder}, ending ${last4}`"
      :class="[
        'relative isolate aspect-[85.6/54] w-full overflow-hidden rounded-[5cqw]',
        'shadow-[0_1px_2px_rgb(0_0_0/0.12),0_14px_32px_-10px_rgb(0_0_0/0.4)]',
        'transition-[transform,box-shadow] ease-bouncy',
        pose.active ? 'duration-(--duration-fast)' : 'duration-(--duration-spring)',
      ]"
      :style="{
        background: look.bg,
        color: look.ink,
        transform: `rotateX(${pose.rx}deg) rotateY(${pose.ry}deg)`,
      }"
    >
      <div class="absolute inset-0 z-1 flex flex-col p-[6.5cqw]">
        <div class="flex items-start justify-between gap-[4cqw]">
          <div class="flex min-w-0 flex-col gap-[1cqw]">
            <span class="text-[6.4cqw] leading-none font-semibold tracking-[-0.02em]">{{
              bankName
            }}</span>
            <span
              class="text-[2.8cqw] leading-none font-medium"
              :style="{ color: look.inkMuted }"
              >{{ tagline }}</span
            >
          </div>
          <Nfc class="size-[6cqw] flex-none" aria-hidden="true" :style="{ color: look.inkMuted }" />
        </div>
        <div class="flex-1" />
        <!-- EMV chip -->
        <div
          aria-hidden="true"
          class="relative mb-[5cqw] h-[9cqw] w-[11.5cqw] overflow-hidden rounded-[1.8cqw] bg-[linear-gradient(140deg,#ecebe6_0%,#bdbcb6_45%,#dcdbd5_70%,#aaa9a3_100%)] shadow-[inset_0_0_0_0.25cqw_rgba(0,0,0,.18)]"
        >
          <div class="absolute inset-x-0 top-[33%] h-[0.25cqw] bg-black/20" />
          <div class="absolute inset-x-0 top-[66%] h-[0.25cqw] bg-black/20" />
          <div class="absolute inset-y-0 left-1/2 w-[0.25cqw] bg-black/20" />
        </div>
        <div class="flex items-end justify-between gap-[4cqw]">
          <div class="flex min-w-0 flex-col gap-[1.6cqw]">
            <span class="truncate text-[3.4cqw] leading-none font-medium">{{ holder }}</span>
            <span
              class="text-[3.4cqw] leading-none tracking-[0.06em] whitespace-nowrap tabular-nums"
              :style="{ color: look.inkMuted }"
              >{{ showNumber ? number : `•••• ${last4}` }} · {{ expiry }}</span
            >
          </div>
          <div class="flex flex-col items-end gap-[1cqw]">
            <span class="text-[5.4cqw] leading-none font-bold tracking-[-0.01em] italic">{{
              network
            }}</span>
            <span
              class="text-[2.6cqw] leading-none font-medium"
              :style="{ color: look.inkMuted }"
              >{{ tier }}</span
            >
          </div>
        </div>
      </div>
      <!-- Sheen + rim: a soft highlight that tracks the pointer, and a hairline glass edge. -->
      <div
        aria-hidden="true"
        class="pointer-events-none absolute inset-0 z-2 rounded-[inherit] shadow-[inset_1px_1px_0_-0.5px_rgb(255_255_255/0.45),inset_0_0_0_0.5px_rgb(255_255_255/0.12)] transition-[background-position] duration-(--duration-spring) ease-smooth"
        :style="{
          background: `radial-gradient(70% 90% at ${pose.sx}% ${pose.sy}%, rgb(255 255 255 / ${look.sheen}), rgb(255 255 255 / 0) 60%)`,
          opacity: pose.active ? 1 : 0.55,
          transition: 'opacity var(--duration-slow) var(--ease-smooth)',
        }"
      />
    </div>
  </div>
</template>
