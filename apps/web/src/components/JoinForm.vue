<script setup lang="ts">
import { GButton, GInput } from '@khata/glass'
import { ref } from 'vue'

const email = ref('')
const joined = ref(false)
</script>

<template>
  <section
    id="join"
    aria-labelledby="join-title"
    class="flex scroll-mt-24 flex-col items-center gap-4 rounded-2xl bg-surface px-6 py-14 text-center sm:px-8"
  >
    <h2
      id="join-title"
      class="m-0 text-[clamp(28px,4vw,40px)] leading-[1.1] font-bold tracking-[-0.025em] [text-wrap:balance]"
    >
      Start your first khata
    </h2>
    <p class="m-0 max-w-[440px] text-body text-label-secondary">
      We'll send a link to sign in. No password to remember.
    </p>
    <form
      class="mt-3 flex w-full max-w-[500px] flex-wrap justify-center gap-2.5"
      @submit.prevent="joined = true"
    >
      <GInput
        v-model="email"
        type="email"
        required
        placeholder="you@example.com"
        aria-label="Email address"
        class="h-12 min-w-0 flex-[1_1_260px] rounded-full px-5"
        @input="joined = false"
      />
      <GButton
        type="submit"
        size="lg"
        class="h-12"
        :class="joined ? '[--glass-tint:var(--color-green)]' : undefined"
      >
        {{ joined ? 'Check your inbox' : 'Send my link' }}
      </GButton>
    </form>
    <span class="sr-only" role="status">{{
      joined ? 'Sign-in link sent. Check your inbox.' : ''
    }}</span>
  </section>
</template>
