<script setup lang="ts">
import { KButton } from '@khata/ui'
import { Cookie } from '@lucide/vue'
import { ref } from 'vue'

import { setConsent, storedConsent } from '@/lib/analytics'

/** DPDP-friendly analytics consent: GA stays in denied mode until someone says yes. */
const show = ref(storedConsent() === null && !!import.meta.env.VITE_GA_MEASUREMENT_ID)

function choose(granted: boolean) {
  setConsent(granted)
  show.value = false
}
</script>

<template>
  <Transition
    enter-from-class="translate-y-4 opacity-0"
    leave-to-class="translate-y-4 opacity-0"
    enter-active-class="transition duration-(--duration-slow) ease-standard"
    leave-active-class="transition duration-(--duration-normal) ease-standard"
  >
    <section
      v-if="show"
      role="region"
      aria-label="Analytics consent"
      class="fixed inset-x-4 bottom-28 z-[90] mx-auto flex max-w-[640px] flex-wrap items-center gap-4 rounded-2xl border border-line bg-surface p-5 shadow-floating lg:bottom-6"
    >
      <Cookie :size="22" aria-hidden="true" class="shrink-0 text-primary" />
      <p class="m-0 min-w-0 flex-[1_1_260px] text-sm text-fg-muted">
        Can we use Google Analytics to see which screens get used? We never send amounts, names or
        notes — only events like “added an entry”. You can change this in Settings.
      </p>
      <div class="flex gap-2">
        <KButton size="sm" variant="secondary" @click="choose(false)">No thanks</KButton>
        <KButton size="sm" @click="choose(true)">Allow</KButton>
      </div>
    </section>
  </Transition>
</template>
