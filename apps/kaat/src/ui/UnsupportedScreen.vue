<script setup lang="ts">
import { errorCopy } from '@khata/kaat-core'
import { KAlert } from '@khata/ui'

import type { CapabilityReport } from '../engine/capabilities'

defineProps<{ report: CapabilityReport }>()
const copy = errorCopy('UNSUPPORTED_BROWSER')
</script>

<template>
  <main class="grid h-full place-items-center p-8">
    <div class="flex max-w-lg flex-col gap-4">
      <h1 class="m-0 text-3xl font-bold">Kaat needs desktop Chrome</h1>
      <KAlert tone="danger" :title="copy.title" :dismissible="false">
        {{ copy.what }} {{ copy.next }}
      </KAlert>
      <p class="m-0 text-sm text-fg-muted">
        Missing: <span class="font-mono">{{ report.missing.join(', ') }}</span>
      </p>
      <p class="m-0 text-sm text-fg-muted">{{ copy.media }}</p>
    </div>
  </main>
</template>
