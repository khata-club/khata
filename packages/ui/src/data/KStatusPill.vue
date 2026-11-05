<script setup lang="ts">
import { computed } from 'vue'

import KBadge from '../components/KBadge.vue'

export type StatusTone = 'neutral' | 'primary' | 'success' | 'warning' | 'danger'

const { status, tones = {} } = defineProps<{
  /** Machine status, e.g. `delivered`, `submission_uncertain`. Rendered humanised. */
  status: string
  /** Override or extend the default status → tone mapping. */
  tones?: Record<string, StatusTone>
}>()

const DEFAULT_TONES: Record<string, StatusTone> = {
  accepted: 'neutral',
  queued: 'neutral',
  scheduled: 'primary',
  pending: 'neutral',
  submitted: 'primary',
  sending: 'primary',
  delivered: 'success',
  verified: 'success',
  active: 'success',
  healthy: 'success',
  succeeded: 'success',
  delayed: 'warning',
  submission_uncertain: 'warning',
  degraded: 'warning',
  expired: 'warning',
  cancelled: 'neutral',
  bounced: 'danger',
  complained: 'danger',
  suppressed: 'danger',
  rejected: 'danger',
  failed: 'danger',
  revoked: 'danger',
}

const tone = computed(() => tones[status] ?? DEFAULT_TONES[status] ?? 'neutral')
const label = computed(() => {
  const text = status.replace(/[_-]+/g, ' ')
  return text.charAt(0).toUpperCase() + text.slice(1)
})
</script>

<template>
  <KBadge :tone="tone" data-slot="status-pill" :data-status="status">{{ label }}</KBadge>
</template>
