<script setup lang="ts">
import { X } from '@lucide/vue'
import { onBeforeUnmount, onMounted, ref } from 'vue'

import type { RenderStats } from '../engine/render/protocol'
import { estimate } from '../engine/persist/storage'
import { telemetry } from '../engine/telemetry'
import { useEditor } from './useEditor'

/** Internal performance panel (Ctrl+Shift+D). Polls at 2 Hz; never on the per-frame path. */
const editor = useEditor()
const rows = ref<[string, string][]>([])
const errors = ref(telemetry.errors.slice(0, 6))
let timer = 0
const mb = (b: number) => `${(b / 1048576).toFixed(1)} MB`
const ms = (v: number) => `${v.toFixed(1)} ms`

async function poll() {
  let rs: RenderStats | undefined
  try {
    rs = await editor.render.api.stats()
  } catch {
    rs = undefined
  }
  const media = editor.media.stats()
  const mem = performance.memory
  const st = await estimate()
  rows.value = [
    ['FPS', editor.ui.playing ? telemetry.fps().toFixed(1) : '—'],
    ['Dropped frames', String(telemetry.droppedFrames)],
    ['Presented frames', String(telemetry.presentedFrames)],
    [
      'Decode p50 / p95',
      `${ms(telemetry.decodeMs.percentile(50))} / ${ms(telemetry.decodeMs.percentile(95))}`,
    ],
    [
      'Render p50 / p95',
      `${ms(telemetry.renderMs.percentile(50))} / ${ms(telemetry.renderMs.percentile(95))}`,
    ],
    [
      'Seek p50 / p95',
      `${ms(telemetry.seekMs.percentile(50))} / ${ms(telemetry.seekMs.percentile(95))}`,
    ],
    ['Timeline draw p95', ms(telemetry.timelineDrawMs.percentile(95))],
    ['Autosave p95 (main thread)', ms(telemetry.autosaveMs.percentile(95))],
    ['Preview quality', `${editor.ui.quality} · ${Math.round(telemetry.previewScale * 100)}%`],
    [
      'GPU frame textures',
      rs ? `${rs.textures} · ${mb(rs.textureBytes)} / ${mb(rs.textureBudget)}` : '—',
    ],
    ['Frame cache hit rate', rs ? `${Math.round(rs.hitRate * 100)}%` : '—'],
    ['Decoders / readers', rs ? `${rs.inputs} / ${rs.readers}` : '—'],
    [
      'Thumbnails',
      `${media.thumbs.entries} · ${mb(media.thumbs.bytes)} / ${mb(media.thumbs.budget)}`,
    ],
    ['Audio blocks', `${media.pcm.entries} · ${mb(media.pcm.bytes)} / ${mb(media.pcm.budget)}`],
    [
      'Background queue',
      `${media.scheduler.queued} queued · ${media.scheduler.running} running${media.scheduler.pausedBelow !== null ? ' · paused for playback' : ''}`,
    ],
    ['Export', telemetry.exportState],
    ['Undo history', String(editor.store.historySize())],
    ['Storage', st.quota ? `${mb(st.usage)} / ${mb(st.quota)}` : '—'],
    ['JS heap', mem ? `${mb(mem.usedJSHeapSize)} / ${mb(mem.jsHeapSizeLimit)}` : 'n/a'],
  ]
  errors.value = telemetry.errors.slice(0, 6)
}

onMounted(() => {
  void poll()
  timer = window.setInterval(poll, 500)
})
onBeforeUnmount(() => clearInterval(timer))
</script>

<template>
  <aside
    class="fixed top-14 right-4 z-[150] w-[360px] rounded-md border border-white/10 bg-gray-900/95 p-3 font-mono text-[11px] text-gray-200 shadow-floating backdrop-blur"
    aria-label="Performance diagnostics"
    data-testid="diagnostics"
  >
    <div class="mb-2 flex items-center">
      <span class="flex-1 font-sans text-xs font-bold tracking-label text-white uppercase"
        >Diagnostics</span
      >
      <button
        class="k-icon-btn text-gray-300 hover:bg-white/10"
        aria-label="Close diagnostics"
        @click="editor.ui.diagnostics = false"
      >
        <X />
      </button>
    </div>
    <dl class="m-0 grid grid-cols-[1fr_auto] gap-x-3 gap-y-0.5">
      <template v-for="[k, v] in rows" :key="k">
        <dt class="text-gray-400">{{ k }}</dt>
        <dd class="m-0 text-right tabular-nums">{{ v }}</dd>
      </template>
    </dl>
    <div v-if="errors.length" class="mt-2 border-t border-white/10 pt-2">
      <p class="m-0 mb-1 text-gray-400">Last engine errors</p>
      <p
        v-for="e in errors"
        :key="e.at + e.message"
        class="text-red-300 m-0 truncate"
        :title="e.message"
      >
        {{ e.code }}: {{ e.message }}
      </p>
    </div>
  </aside>
</template>
