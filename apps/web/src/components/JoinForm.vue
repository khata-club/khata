<script setup lang="ts">
import { cn, KButton, KInput } from '@khata/ui'
import { ref } from 'vue'

const email = ref('')
const joined = ref(false)
</script>

<template>
  <!-- Flat panel, bordered input with a focus ring, solid button (no inset shadows). -->
  <section
    id="join"
    aria-labelledby="join-title"
    class="flex scroll-mt-24 flex-col items-center gap-5 rounded-2xl border border-line bg-surface-subtle px-8 py-12 text-center"
  >
    <h2
      id="join-title"
      class="m-0 text-[clamp(28px,4vw,40px)] leading-[1.15] font-bold [text-wrap:balance]"
    >
      Start your first khata
    </h2>
    <p class="m-0 max-w-[440px] text-base text-fg-muted">
      We'll send a link to sign in. No password to remember.
    </p>
    <form
      class="mt-2 flex w-full max-w-[520px] flex-wrap justify-center gap-3"
      @submit.prevent="joined = true"
    >
      <KInput
        v-model="email"
        type="email"
        required
        placeholder="you@example.com"
        aria-label="Email address"
        class="min-w-0 flex-[1_1_260px] rounded-full border bg-surface px-5 shadow-none focus:shadow-focus-halo"
        @input="joined = false"
      />
      <KButton
        type="submit"
        :class="cn('h-[52px]', joined && 'bg-success enabled:hover:bg-success')"
      >
        {{ joined ? 'Check your inbox' : 'Send my link' }}
      </KButton>
    </form>
    <span class="sr-only" role="status">{{
      joined ? 'Sign-in link sent. Check your inbox.' : ''
    }}</span>
  </section>
</template>
