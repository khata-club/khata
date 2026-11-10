<script setup lang="ts">
import { Type } from '@lucide/vue'

import { useEditor } from '../useEditor'

const editor = useEditor()

const presets = [
  { name: 'Title', content: 'Title', fontSize: 140, fontWeight: 700, y: 0 },
  { name: 'Subtitle', content: 'Subtitle', fontSize: 72, fontWeight: 500, y: 120 },
  {
    name: 'Lower third',
    content: 'Name Surname\nRole',
    fontSize: 56,
    fontWeight: 600,
    y: 360,
    align: 'left' as const,
  },
  { name: 'Caption', content: 'Caption text', fontSize: 48, fontWeight: 500, y: 430 },
  { name: 'Mono', content: '00:00', fontSize: 96, fontWeight: 500, y: 0, fontFamily: 'Geist Mono' },
]
</script>

<template>
  <div class="flex flex-col gap-2 p-3">
    <p class="m-0 text-xs text-fg-muted">
      Adds a text layer at the playhead, on the top free video track.
    </p>
    <button
      v-for="p in presets"
      :key="p.name"
      class="flex cursor-pointer items-center gap-3 rounded-md border border-line bg-surface p-3 text-left hover:border-primary-accent hover:bg-primary-subtle"
      :data-testid="`text-${p.name}`"
      @click="editor.addText(p)"
    >
      <Type class="size-4 flex-none text-[#7b4bd1]" />
      <span class="flex-1">
        <span class="block text-sm font-semibold" :style="{ fontFamily: p.fontFamily }">{{
          p.name
        }}</span>
        <span class="block text-[11px] text-fg-muted">{{ p.fontSize }}px · {{ p.fontWeight }}</span>
      </span>
    </button>
  </div>
</template>
