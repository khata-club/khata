<script setup lang="ts">
import { ArrowRight, Bell, FileDown, History, Users } from '@lucide/vue'
import { KButton } from '@khata/ui'

import JoinForm from './components/JoinForm.vue'
import LedgerDemo from './components/LedgerDemo.vue'

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
    title: 'Shared by default',
    body: 'One ledger, one balance, visible to everyone in the group.',
  },
  {
    icon: History,
    title: 'Full history',
    body: 'Edits keep the original entry, so nothing changes quietly.',
  },
  {
    icon: Bell,
    title: 'Gentle reminders',
    body: 'A polite nudge when a balance has sat open for a week.',
  },
  {
    icon: FileDown,
    title: 'Export anytime',
    body: 'Download any khata as CSV or PDF when the trip is over.',
  },
]
</script>

<template>
  <div class="min-h-screen bg-canvas font-sans text-fg">
    <header class="sticky top-0 z-10 border-b border-line bg-white/86 backdrop-blur-[10px]">
      <div class="mx-auto flex max-w-[1180px] items-center gap-6 px-6 py-4">
        <a
          href="#"
          class="flex items-baseline gap-0.5 text-xl font-bold tracking-[0.04em] text-fg no-underline"
        >
          khata<span class="font-medium text-primary">.club</span>
        </a>
        <nav aria-label="Main" class="ml-auto flex flex-wrap gap-1 max-sm:hidden">
          <a
            v-for="l in [
              { href: '#how', label: 'How it works' },
              { href: '#features', label: 'Features' },
            ]"
            :key="l.href"
            :href="l.href"
            class="inline-flex h-10 items-center rounded-full px-4 text-sm font-semibold text-fg-muted no-underline transition-colors duration-(--duration-normal) hover:bg-primary-subtle hover:text-primary"
          >
            {{ l.label }}
          </a>
        </nav>
        <KButton as="a" href="#join" size="sm" class="max-sm:ml-auto">Start a khata</KButton>
      </div>
    </header>

    <main class="mx-auto flex max-w-[1180px] flex-col gap-24 px-6 pb-16">
      <section
        aria-labelledby="hero-title"
        class="grid grid-cols-[repeat(auto-fit,minmax(min(100%,440px),1fr))] items-center gap-12 pt-16"
      >
        <div class="flex flex-col gap-6">
          <span
            class="inline-flex h-[26px] items-center gap-2 self-start rounded-md bg-primary-subtle px-3 text-xs font-semibold tracking-label text-primary uppercase"
          >
            <span class="size-1.5 rounded-full bg-success" aria-hidden="true" />Shared ledgers
          </span>
          <h1
            id="hero-title"
            class="m-0 text-[clamp(40px,6vw,64px)] leading-[1.05] font-bold tracking-[-0.01em] [text-wrap:balance]"
          >
            One khata for every group you split with.
          </h1>
          <p class="m-0 max-w-[480px] text-lg [text-wrap:pretty] text-fg-muted">
            Log what was paid and who it was for. Everyone in the group sees the same running
            balance, so settling up takes one tap.
          </p>
          <div class="mt-2 flex flex-wrap gap-4">
            <KButton as="a" href="#join" size="lg" class="group gap-3">
              Start a khata
              <ArrowRight
                class="transition-transform duration-(--duration-slow) ease-standard group-hover:translate-x-1 group-focus-visible:translate-x-1"
              />
            </KButton>
            <KButton as="a" href="#how" size="lg" variant="secondary">See how it works</KButton>
          </div>
          <span class="font-mono text-xs text-fg-muted"
            >Free for groups up to 12 · No card needed</span
          >
        </div>
        <LedgerDemo />
      </section>

      <section id="how" aria-labelledby="how-title" class="flex scroll-mt-24 flex-col gap-8">
        <div class="flex flex-col gap-1 border-b border-line pb-5">
          <span class="font-mono text-xs text-fg-muted">How it works</span>
          <h2 id="how-title" class="m-0 text-3xl font-semibold">Three steps, no spreadsheets</h2>
        </div>
        <ol
          class="m-0 grid list-none grid-cols-[repeat(auto-fit,minmax(min(100%,280px),1fr))] gap-6 p-0"
        >
          <li
            v-for="(s, i) in steps"
            :key="s.title"
            class="flex flex-col gap-4 rounded-xl border border-line bg-surface p-8 shadow-raised transition-[transform,box-shadow] duration-(--duration-normal) ease-standard hover:-translate-y-0.5 hover:shadow-floating"
          >
            <span class="font-mono text-sm text-fg-muted" aria-hidden="true">0{{ i + 1 }}.</span>
            <h3 class="m-0 text-xl font-semibold">{{ s.title }}</h3>
            <p class="m-0 text-base [text-wrap:pretty] text-fg-muted">{{ s.body }}</p>
          </li>
        </ol>
      </section>

      <section
        id="features"
        aria-labelledby="features-title"
        class="flex scroll-mt-24 flex-col gap-8"
      >
        <div class="flex flex-wrap items-end justify-between gap-4 border-b border-line pb-5">
          <div class="flex flex-col gap-1">
            <span class="font-mono text-xs text-fg-muted">Features</span>
            <h2 id="features-title" class="m-0 text-3xl font-semibold">
              Built for the group, not the organiser
            </h2>
          </div>
          <p class="m-0 max-w-[420px] text-base text-fg-muted">
            Anyone in the khata can add, edit or settle. Every change is recorded.
          </p>
        </div>
        <ul
          class="m-0 grid list-none grid-cols-[repeat(auto-fit,minmax(min(100%,240px),1fr))] gap-x-6 gap-y-8 p-0"
        >
          <li v-for="f in features" :key="f.title" class="flex flex-col gap-3">
            <span
              class="grid size-12 place-items-center rounded-full border border-line bg-surface text-primary shadow-raised-sm"
            >
              <component :is="f.icon" :size="22" aria-hidden="true" />
            </span>
            <h3 class="m-0 text-lg font-semibold">{{ f.title }}</h3>
            <p class="m-0 text-sm text-fg-muted">{{ f.body }}</p>
          </li>
        </ul>
      </section>

      <JoinForm />
    </main>

    <footer class="border-t border-line">
      <div class="mx-auto flex max-w-[1180px] flex-wrap items-center gap-x-8 gap-y-4 px-6 py-8">
        <span class="font-bold tracking-[0.04em]"
          >khata<span class="font-medium text-primary">.club</span></span
        >
        <nav aria-label="Footer" class="flex flex-wrap gap-6 text-sm font-semibold">
          <a
            v-for="l in ['Privacy', 'Terms', 'Contact']"
            :key="l"
            href="#"
            class="text-fg-muted no-underline hover:text-primary"
            >{{ l }}</a
          >
        </nav>
        <span class="ml-auto font-mono text-xs text-fg-muted">© 2026 khata.club</span>
      </div>
    </footer>
  </div>
</template>
