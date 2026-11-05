<script setup lang="ts">
import { formatTimecode } from '@khata/kaat-core'
import { KSelect } from '@khata/ui'
import {
  ChevronFirst,
  ChevronLast,
  Pause,
  Play,
  Repeat,
  Rewind,
  FastForward,
  StepBack,
  StepForward,
} from '@lucide/vue'
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'

import type { PreviewQuality } from '../engine/render/renderService'
import { useEditor } from './useEditor'

const editor = useEditor()
const stage = ref<HTMLDivElement>()
const canvas = ref<HTMLCanvasElement>()
const timecode = ref<HTMLSpanElement>()
const box = ref({ w: 640, h: 360 })
let ro: ResizeObserver | undefined
let offTime: (() => void) | undefined

const aspect = computed(() => {
  const s = editor.project.value?.settings
  return s ? s.width / s.height : 16 / 9
})

const canvasStyle = computed(() => {
  const { w, h } = box.value
  const a = aspect.value
  const cw = Math.min(w, h * a)
  const ch = cw / a
  return { width: `${Math.floor(cw)}px`, height: `${Math.floor(ch)}px` }
})

const quality = computed({
  get: () => editor.ui.quality,
  set: (q: string) => editor.setQuality(q as PreviewQuality),
})

const durationTc = computed(() => {
  const p = editor.project.value
  return p ? formatTimecode(editor.duration(), p.settings.fps) : ''
})

function writeTimecode(t: number) {
  const p = editor.store.project
  if (timecode.value) timecode.value.textContent = formatTimecode(t, p.settings.fps)
}

onMounted(() => {
  editor.attachCanvas(canvas.value!)
  offTime = editor.transport.on('time', writeTimecode)
  writeTimecode(0)
  ro = new ResizeObserver(([e]) => {
    if (!e) return
    box.value = { w: e.contentRect.width - 16, h: e.contentRect.height - 16 }
    const a = aspect.value
    const cw = Math.min(box.value.w, box.value.h * a)
    editor.render.setViewport(cw, cw / a)
    editor.render.request(editor.transport.time, 'still')
  })
  ro.observe(stage.value!)
  // Restore the last session's project, if any.
  void editor.restore()
})

onBeforeUnmount(() => {
  ro?.disconnect()
  offTime?.()
})

const playLabel = computed(() => (editor.ui.playing ? 'Pause (Space)' : 'Play (Space)'))
const rateLabel = computed(() =>
  editor.ui.playing && editor.ui.rate !== 1 ? `${editor.ui.rate}×` : '',
)
</script>

<template>
  <section class="flex h-full min-h-0 flex-col bg-gray-900" aria-label="Preview">
    <div ref="stage" class="relative grid min-h-0 flex-1 place-items-center overflow-hidden p-2">
      <canvas
        ref="canvas"
        data-testid="preview-canvas"
        class="block bg-black shadow-[0_0_0_1px_rgba(255,255,255,0.06)]"
        :style="canvasStyle"
      />
      <span
        v-if="rateLabel"
        class="absolute top-3 right-3 rounded-sm bg-black/60 px-2 py-0.5 font-mono text-xs text-white"
        >{{ rateLabel }}</span
      >
    </div>
    <div
      class="flex h-11 flex-none items-center gap-1 border-t border-white/10 bg-gray-900 px-3 text-white"
    >
      <span ref="timecode" data-testid="timecode" class="w-[92px] font-mono text-sm tabular-nums"
        >00:00:00:00</span
      >
      <span class="font-mono text-xs text-gray-400">/ {{ durationTc }}</span>
      <div
        class="flex flex-1 items-center justify-center gap-0.5 [&_.k-icon-btn]:text-gray-300 [&_.k-icon-btn:hover]:bg-white/10 [&_.k-icon-btn:hover]:text-white"
      >
        <button
          class="k-icon-btn"
          aria-label="Go to start (Home)"
          title="Start (Home)"
          @click="editor.transport.seek(0)"
        >
          <ChevronFirst />
        </button>
        <button
          class="k-icon-btn"
          aria-label="Reverse shuttle (J)"
          title="Reverse (J)"
          @click="editor.transport.shuttle('j')"
        >
          <Rewind />
        </button>
        <button
          class="k-icon-btn"
          aria-label="Previous frame (Left)"
          title="Previous frame (←)"
          @click="editor.transport.stepFrames(-1)"
        >
          <StepBack />
        </button>
        <button
          class="k-icon-btn size-9! rounded-full! bg-white/10 text-white!"
          :aria-label="playLabel"
          :title="playLabel"
          data-testid="play"
          @click="editor.transport.toggle()"
        >
          <Pause v-if="editor.ui.playing" class="size-5!" />
          <Play v-else class="size-5!" />
        </button>
        <button
          class="k-icon-btn"
          aria-label="Next frame (Right)"
          title="Next frame (→)"
          @click="editor.transport.stepFrames(1)"
        >
          <StepForward />
        </button>
        <button
          class="k-icon-btn"
          aria-label="Forward shuttle (L)"
          title="Forward (L)"
          @click="editor.transport.shuttle('l')"
        >
          <FastForward />
        </button>
        <button
          class="k-icon-btn"
          aria-label="Go to end (End)"
          title="End (End)"
          @click="editor.transport.seek(editor.duration())"
        >
          <ChevronLast />
        </button>
        <button
          class="k-icon-btn ml-2"
          :aria-pressed="editor.ui.loop"
          aria-label="Loop in/out range"
          title="Loop (Ctrl+L)"
          @click="editor.toggleLoop()"
        >
          <Repeat />
        </button>
      </div>
      <KSelect
        v-model="quality"
        aria-label="Preview quality"
        class="h-7! w-28! rounded-sm! border-white/15! bg-white/5! px-2! text-xs! text-white! shadow-none!"
        :options="[
          { value: 'auto', label: 'Auto' },
          { value: 'full', label: 'Full' },
          { value: 'half', label: 'Half' },
          { value: 'quarter', label: 'Quarter' },
        ]"
      />
    </div>
  </section>
</template>
