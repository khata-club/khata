<script setup lang="ts">
import { KButton } from '@khata/ui'
import { ChevronLeft, ChevronRight } from '@lucide/vue'

import { addMonths, formatMonth, monthOf, todayIST } from '#shared/dates'

const model = defineModel<string>({ required: true })
const current = monthOf(todayIST())
</script>

<template>
  <div class="flex items-center gap-1" role="group" aria-label="Month">
    <KButton
      variant="ghost"
      size="sm"
      icon-only
      aria-label="Previous month"
      @click="model = addMonths(model, -1)"
    >
      <ChevronLeft :size="18" />
    </KButton>
    <span class="min-w-[92px] text-center text-sm font-semibold tabular-nums" aria-live="polite">{{
      formatMonth(model)
    }}</span>
    <KButton
      variant="ghost"
      size="sm"
      icon-only
      aria-label="Next month"
      :disabled="model >= current"
      @click="model = addMonths(model, 1)"
    >
      <ChevronRight :size="18" />
    </KButton>
  </div>
</template>
