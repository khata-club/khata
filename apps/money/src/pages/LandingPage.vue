<script setup lang="ts">
import { KButton } from '@khata/ui'
import { CalendarClock, Landmark, Lock, PiggyBank, Scale, Smartphone } from '@lucide/vue'
import { ref } from 'vue'
import { useRouter } from 'vue-router'

import { signInWithGoogle } from '@/lib/auth'

const router = useRouter()
const busy = ref(false)
const dev = import.meta.env.DEV

async function google() {
  busy.value = true
  try {
    await signInWithGoogle()
  } finally {
    busy.value = false
  }
}

async function demo() {
  await fetch('/api/dev/login', { method: 'POST', credentials: 'include' })
  router.push({ name: 'dashboard', query: { signed_in: '1' } })
}

const features = [
  {
    icon: Smartphone,
    title: 'Log in seconds',
    body: 'UPI, cash, card or net banking — one tap to add, with Indian categories ready to go.',
  },
  {
    icon: PiggyBank,
    title: 'Budgets that nudge',
    body: 'Set a monthly limit for groceries, dining or fuel and see what is left at a glance.',
  },
  {
    icon: CalendarClock,
    title: 'Bills, SIPs & EMIs',
    body: 'Never miss a due date. Mark paid in one tap and watch your loan shrink.',
  },
  {
    icon: Scale,
    title: 'Net worth',
    body: 'FDs, PPF, EPF, NPS, mutual funds, gold and stocks — your whole picture in lakhs and crores.',
  },
  {
    icon: Landmark,
    title: '80C & 80D tracker',
    body: 'See how much of your ₹1.5L 80C limit is used before March, not after.',
  },
  {
    icon: Lock,
    title: 'No bank logins',
    body: 'Nothing is pulled from your bank. You decide what goes in; export it any time as CSV.',
  },
]
</script>

<template>
  <div class="min-h-dvh bg-canvas font-sans text-fg">
    <header class="mx-auto flex max-w-[1120px] items-center gap-4 px-6 py-5">
      <span class="flex items-baseline gap-0.5 text-xl font-bold tracking-[0.04em]">
        khata<span class="font-medium text-primary">.money</span>
      </span>
    </header>
    <main class="mx-auto flex max-w-[1120px] flex-col gap-20 px-6 pb-20">
      <section aria-labelledby="hero" class="flex flex-col items-start gap-6 pt-10 sm:pt-16">
        <span
          class="inline-flex h-[26px] items-center gap-2 rounded-md bg-primary-subtle px-3 text-xs font-semibold tracking-label text-primary uppercase"
        >
          <span class="size-1.5 rounded-full bg-success" aria-hidden="true" />Personal finance, made
          in India
        </span>
        <h1
          id="hero"
          class="m-0 max-w-[760px] text-[clamp(38px,6vw,60px)] leading-[1.05] font-bold [text-wrap:balance]"
        >
          Your money, on one calm page.
        </h1>
        <p class="m-0 max-w-[560px] text-lg [text-wrap:pretty] text-fg-muted">
          Track spending, budgets, bills, SIPs and EMIs, savings goals, net worth and tax-saving —
          in rupees, by financial year, without linking a single bank account.
        </p>
        <div class="flex flex-wrap gap-3">
          <KButton size="lg" class="gap-3" :loading="busy" @click="google">
            <svg aria-hidden="true" viewBox="0 0 24 24" class="size-5 rounded-full bg-white p-0.5">
              <path
                fill="#4285F4"
                d="M22.5 12.3c0-.8-.1-1.5-.2-2.2H12v4.2h5.9a5 5 0 0 1-2.2 3.3v2.7h3.5c2.1-1.9 3.3-4.7 3.3-8z"
              />
              <path
                fill="#34A853"
                d="M12 23c3 0 5.5-1 7.3-2.7l-3.5-2.7c-1 .7-2.3 1.1-3.8 1.1-2.9 0-5.4-2-6.3-4.6H2.1v2.8A11 11 0 0 0 12 23z"
              />
              <path fill="#FBBC05" d="M5.7 14.1a6.6 6.6 0 0 1 0-4.2V7.1H2.1a11 11 0 0 0 0 9.8z" />
              <path
                fill="#EA4335"
                d="M12 5.4c1.6 0 3.1.6 4.2 1.7l3.2-3.2A11 11 0 0 0 2.1 7.1l3.6 2.8C6.6 7.4 9.1 5.4 12 5.4z"
              />
            </svg>
            Continue with Google
          </KButton>
          <KButton v-if="dev" size="lg" variant="secondary" @click="demo"
            >Try the demo (dev)</KButton
          >
        </div>
        <span class="font-mono text-xs text-fg-muted"
          >Free · Your data stays yours · Delete everything any time</span
        >
      </section>

      <section aria-labelledby="features-title" class="flex flex-col gap-8">
        <h2 id="features-title" class="m-0 border-b border-line pb-5 text-3xl font-semibold">
          Everything a household needs
        </h2>
        <ul
          class="m-0 grid list-none grid-cols-[repeat(auto-fit,minmax(min(100%,300px),1fr))] gap-5 p-0"
        >
          <li
            v-for="f in features"
            :key="f.title"
            class="flex flex-col gap-3 rounded-xl border border-line bg-surface p-6 shadow-raised"
          >
            <span
              class="grid size-10 place-items-center rounded-full bg-primary-subtle text-primary"
            >
              <component :is="f.icon" :size="20" aria-hidden="true" />
            </span>
            <h3 class="m-0 text-lg font-semibold">{{ f.title }}</h3>
            <p class="m-0 text-sm text-fg-muted">{{ f.body }}</p>
          </li>
        </ul>
      </section>
    </main>
  </div>
</template>
