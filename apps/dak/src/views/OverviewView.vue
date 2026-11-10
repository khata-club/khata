<script setup lang="ts">
import { useQuery } from '@tanstack/vue-query'
import { KBadge, KSpinner } from '@khata/ui'
import { STREAMS } from '@khata/dak-core'

import { api, type Health } from '@/lib/api'

const health = useQuery({
  queryKey: ['health'],
  queryFn: () => api<Health>('/health'),
  retry: false,
})
</script>

<template>
  <section class="flex flex-col gap-6">
    <div class="flex flex-wrap items-center gap-3">
      <KSpinner v-if="health.isPending.value" class="size-4" />
      <KBadge v-else-if="health.data.value?.ok" tone="success">
        API online · {{ health.data.value.env }}
      </KBadge>
      <KBadge v-else tone="danger">API unreachable</KBadge>
    </div>

    <p class="max-w-prose text-fg-muted">
      Send, design and troubleshoot every email from one place. Verify a domain, create a restricted
      key and send your first message to get started.
    </p>

    <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <div
        v-for="s in STREAMS"
        :key="s"
        class="rounded-lg border border-line bg-surface p-4 shadow-raised-sm"
      >
        <p class="text-xs font-semibold tracking-wide text-fg-muted uppercase">Stream</p>
        <p class="mt-1 text-lg font-semibold capitalize">{{ s }}</p>
      </div>
    </div>
  </section>
</template>
