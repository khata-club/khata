<script setup lang="ts">
import { type Track, activeSequence } from '@khata/kaat-core'
import { KNumberField, KSlider } from '@khata/ui'
import { computed } from 'vue'

import { useEditor } from '../useEditor'

const editor = useEditor()
const tracks = computed<Track[]>(() => {
  const p = editor.project.value
  return p ? activeSequence(p).tracks.filter((t) => t.kind === 'audio') : []
})
const master = computed({
  get: () => editor.project.value?.settings.masterGainDb ?? 0,
  set: (v: number) => editor.exec({ type: 'setSettings', patch: { masterGainDb: v } }),
})
function gain(t: Track, v: number) {
  editor.exec({ type: 'updateTrack', trackId: t.id, patch: { gainDb: v } })
}
</script>

<template>
  <div class="flex flex-col gap-4 p-3">
    <section class="flex flex-col gap-2">
      <h3 class="k-panel-title">Master</h3>
      <div class="flex items-center gap-2">
        <KSlider
          v-model="master"
          :min="-30"
          :max="12"
          :step="0.5"
          label="Master level"
          @commit="editor.store.breakMerge()"
        />
        <KNumberField
          v-model="master"
          suffix="dB"
          :min="-60"
          :max="12"
          :step="0.5"
          :precision="1"
          class="w-24"
        />
      </div>
    </section>
    <section class="flex flex-col gap-2">
      <h3 class="k-panel-title">Tracks</h3>
      <div
        v-for="t in tracks"
        :key="t.id"
        class="flex flex-col gap-1 rounded-md border border-line p-2"
      >
        <div class="flex items-center gap-2">
          <span class="w-8 text-xs font-bold text-success">{{ t.name }}</span>
          <button
            class="k-icon-btn w-auto! px-2 text-xs font-bold"
            :aria-pressed="t.muted"
            @click="editor.exec({ type: 'updateTrack', trackId: t.id, patch: { muted: !t.muted } })"
          >
            M
          </button>
          <button
            class="k-icon-btn w-auto! px-2 text-xs font-bold"
            :aria-pressed="t.solo"
            @click="editor.exec({ type: 'updateTrack', trackId: t.id, patch: { solo: !t.solo } })"
          >
            S
          </button>
          <span class="flex-1" />
          <KNumberField
            :model-value="t.gainDb"
            suffix="dB"
            :min="-60"
            :max="12"
            :step="0.5"
            :precision="1"
            class="w-24"
            @update:model-value="(v: number) => gain(t, v)"
          />
        </div>
        <KSlider
          :model-value="t.gainDb"
          :min="-30"
          :max="12"
          :step="0.5"
          :label="`${t.name} gain`"
          @update:model-value="(v: number) => gain(t, v)"
          @commit="editor.store.breakMerge()"
        />
      </div>
    </section>
  </div>
</template>
