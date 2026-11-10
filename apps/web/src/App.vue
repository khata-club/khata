<script setup lang="ts">
import { ArrowRight, Bell, FileDown, History, Users } from '@lucide/vue'
import { GBadge, GButton, GSegmentedControl, useTheme, type ThemePreference } from '@khata/glass'

import JoinForm from './components/JoinForm.vue'
import LedgerDemo from './components/LedgerDemo.vue'

const { preference } = useTheme()
const THEMES = [
  { value: 'system', label: 'Auto' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
]

const steps = [
  {
    title: 'Open a khata',
    body: 'Name it after the trip, the flat or the team lunch. Share the invite link with the group.',
  },
  {
    title: 'Log as you go',
    body: 'Add an entry in seconds: amount, who paid, who it covers. Split evenly or by share.',
  },
  {
    title: 'Settle up',
    body: 'khata works out the fewest payments needed to clear the group, then marks it closed.',
  },
]
const features = [
  {
    icon: Users,
    color: 'var(--color-blue)',
    title: 'Shared by default',
    body: 'One ledger, one balance, visible to everyone in the group.',
  },
  {
    icon: History,
    color: 'var(--color-orange)',
    title: 'Full history',
    body: 'Edits keep the original entry, so nothing changes quietly.',
  },
  {
    icon: Bell,
    color: 'var(--color-red)',
    title: 'Gentle reminders',
    body: 'A polite nudge when a balance has sat open for a week.',
  },
  {
    icon: FileDown,
    color: 'var(--color-green)',
    title: 'Export anytime',
    body: 'Download any khata as CSV or PDF when the trip is over.',
  },
]
const links = [
  { href: '#how', label: 'How it works' },
  { href: '#features', label: 'Features' },
]
</script>

<template>
  <div class="relative isolate min-h-screen overflow-x-clip bg-canvas font-sans text-label">
    <!-- Soft ambient colour behind the hero, so the glass bar has something to refract. -->
    <div
      aria-hidden="true"
      class="pointer-events-none absolute inset-x-0 top-0 -z-1 h-[820px] [mask-image:linear-gradient(to_bottom,black_55%,transparent)] opacity-70 [background:radial-gradient(42%_50%_at_18%_22%,color-mix(in_srgb,var(--color-blue)_28%,transparent),transparent_70%),radial-gradient(36%_44%_at_86%_14%,color-mix(in_srgb,var(--color-pink)_20%,transparent),transparent_70%),radial-gradient(40%_40%_at_70%_70%,color-mix(in_srgb,var(--color-orange)_16%,transparent),transparent_70%)]"
    />

    <header class="sticky top-3 z-40 px-3">
      <div
        class="mx-auto flex h-14 max-w-[1180px] items-center gap-4 rounded-full glass-regular pr-2 pl-5"
      >
        <a
          href="#"
          class="flex items-baseline text-body font-bold tracking-[-0.02em] text-label no-underline"
        >
          khata<span class="font-medium text-tint">.club</span>
        </a>
        <nav aria-label="Main" class="ml-auto flex gap-1 max-sm:hidden">
          <a
            v-for="l in links"
            :key="l.href"
            :href="l.href"
            class="inline-flex h-9 items-center rounded-full px-3.5 text-subhead font-medium text-label no-underline transition-colors duration-(--duration-fast) hover:bg-fill-tertiary"
          >
            {{ l.label }}
          </a>
        </nav>
        <GButton as="a" href="#join" size="sm" class="h-10 px-4 max-sm:ml-auto">
          Start a khata
        </GButton>
      </div>
    </header>

    <main class="mx-auto flex max-w-[1180px] flex-col gap-24 px-6 pb-16">
      <section
        aria-labelledby="hero-title"
        class="grid grid-cols-[repeat(auto-fit,minmax(min(100%,440px),1fr))] items-center gap-12 pt-16 sm:pt-20"
      >
        <div class="flex animate-g-rise flex-col gap-5">
          <GBadge tone="accent" dot class="self-start">Shared ledgers</GBadge>
          <h1
            id="hero-title"
            class="m-0 text-[clamp(40px,6.4vw,68px)] leading-[1.02] font-bold tracking-[-0.035em] [text-wrap:balance]"
          >
            One khata for every group you split with.
          </h1>
          <p
            class="m-0 max-w-[480px] text-title-3 font-normal [text-wrap:pretty] text-label-secondary"
          >
            Log what was paid and who it was for. Everyone in the group sees the same running
            balance, so settling up takes one tap.
          </p>
          <div class="mt-2 flex flex-wrap gap-3">
            <GButton as="a" href="#join" size="lg" class="group">
              Start a khata
              <ArrowRight
                class="transition-transform duration-(--duration-spring) ease-bouncy group-hover:translate-x-1 group-focus-visible:translate-x-1"
              />
            </GButton>
            <GButton as="a" href="#how" size="lg" variant="gray">See how it works</GButton>
          </div>
          <span class="text-footnote text-label-secondary">
            Free for groups up to 12 · No card needed
          </span>
        </div>
        <LedgerDemo />
      </section>

      <section id="how" aria-labelledby="how-title" class="flex scroll-mt-24 flex-col gap-6">
        <div class="flex flex-col gap-1">
          <span class="text-subhead font-semibold text-tint">How it works</span>
          <h2 id="how-title" class="m-0 text-title-1 font-bold">Three steps, no spreadsheets</h2>
        </div>
        <ol
          class="m-0 grid list-none grid-cols-[repeat(auto-fit,minmax(min(100%,280px),1fr))] gap-4 p-0"
        >
          <li
            v-for="(s, i) in steps"
            :key="s.title"
            class="flex flex-col gap-3 rounded-xl bg-surface p-6 transition-[translate,box-shadow] duration-(--duration-spring) ease-snappy hover:-translate-y-1 hover:shadow-lift"
          >
            <span
              class="grid size-8 place-items-center rounded-full bg-accent-soft text-subhead font-semibold text-tint tabular-nums"
              aria-hidden="true"
              >{{ i + 1 }}</span
            >
            <h3 class="m-0 text-title-3 font-semibold">{{ s.title }}</h3>
            <p class="m-0 text-body [text-wrap:pretty] text-label-secondary">{{ s.body }}</p>
          </li>
        </ol>
      </section>

      <section
        id="features"
        aria-labelledby="features-title"
        class="flex scroll-mt-24 flex-col gap-6"
      >
        <div class="flex flex-wrap items-end justify-between gap-4">
          <div class="flex flex-col gap-1">
            <span class="text-subhead font-semibold text-tint">Features</span>
            <h2 id="features-title" class="m-0 text-title-1 font-bold">
              Built for the group, not the organiser
            </h2>
          </div>
          <p class="m-0 max-w-[420px] text-body text-label-secondary">
            Anyone in the khata can add, edit or settle. Every change is recorded.
          </p>
        </div>
        <ul
          class="m-0 grid list-none grid-cols-[repeat(auto-fit,minmax(min(100%,240px),1fr))] gap-4 p-0"
        >
          <li
            v-for="f in features"
            :key="f.title"
            class="flex flex-col gap-3 rounded-xl bg-surface p-5"
          >
            <span
              class="grid size-10 place-items-center rounded-[11px] text-white"
              :style="{ background: f.color }"
            >
              <component :is="f.icon" :size="21" :stroke-width="2.25" aria-hidden="true" />
            </span>
            <h3 class="m-0 text-body font-semibold">{{ f.title }}</h3>
            <p class="m-0 text-subhead text-label-secondary">{{ f.body }}</p>
          </li>
        </ul>
      </section>

      <JoinForm />
    </main>

    <footer class="border-t border-separator">
      <div class="mx-auto flex max-w-[1180px] flex-wrap items-center gap-x-8 gap-y-4 px-6 py-8">
        <span class="font-bold tracking-[-0.02em]"
          >khata<span class="font-medium text-tint">.club</span></span
        >
        <nav aria-label="Footer" class="flex flex-wrap gap-6 text-subhead">
          <a
            v-for="l in ['Privacy', 'Terms', 'Contact']"
            :key="l"
            href="#"
            class="text-label-secondary no-underline hover:text-label"
            >{{ l }}</a
          >
        </nav>
        <GSegmentedControl
          :model-value="preference"
          :options="THEMES"
          label="Appearance"
          size="sm"
          class="ml-auto"
          @update:model-value="preference = ($event ?? 'system') as ThemePreference"
        />
        <span class="text-footnote text-label-secondary">© 2026 khata.club</span>
      </div>
    </footer>
  </div>
</template>
