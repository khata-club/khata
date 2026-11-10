<script setup lang="ts">
import { type AnimatableProp, type Clip, evaluateChannel, floorToFrame } from '@khata/kaat-core'
import { KNumberField } from '@khata/ui'
import { ChevronLeft, ChevronRight, Diamond } from '@lucide/vue'
import { computed } from 'vue'

import { useEditor } from '../useEditor'

/**
 * One animatable property. Without keyframes it edits the static value; once a keyframe exists,
 * edits set a keyframe at the playhead (like most NLEs).
 */
const {
  clip,
  prop,
  label,
  suffix,
  factor = 1,
  min,
  max,
  step = 1,
  precision = 0,
} = defineProps<{
  clip: Clip
  prop: AnimatableProp
  label: string
  suffix?: string
  /** Display multiplier (e.g. 100 for percent). */
  factor?: number
  min?: number
  max?: number
  step?: number
  precision?: number
}>()

const editor = useEditor()
const fps = computed(() => editor.project.value!.settings.fps)
const local = computed(() => {
  const t = floorToFrame(editor.ui.playhead, fps.value) - clip.start
  return Math.max(0, Math.min(clip.duration, t))
})
const kfs = computed(() => clip.keyframes[prop] ?? [])
const animated = computed(() => kfs.value.length > 0)
const onKey = computed(() => kfs.value.find((k) => k.t === local.value))
const inRange = computed(
  () => editor.ui.playhead >= clip.start && editor.ui.playhead <= clip.start + clip.duration,
)

const value = computed({
  get: () => evaluateChannel(clip.keyframes[prop], local.value, clip.transform[prop]) * factor,
  set: (v: number) => {
    const raw = v / factor
    if (animated.value)
      editor.exec({ type: 'setKeyframe', clipId: clip.id, prop, t: local.value, v: raw })
    else
      editor.exec({ type: 'setClipProps', clipId: clip.id, patch: { transform: { [prop]: raw } } })
  },
})

function toggleKey() {
  if (onKey.value) editor.exec({ type: 'removeKeyframe', clipId: clip.id, prop, t: local.value })
  else
    editor.exec({
      type: 'setKeyframe',
      clipId: clip.id,
      prop,
      t: local.value,
      v: value.value / factor,
    })
  editor.store.breakMerge()
}

function jump(dir: 1 | -1) {
  const list = kfs.value
  const k =
    dir > 0
      ? list.find((x) => x.t > local.value)
      : [...list].reverse().find((x) => x.t < local.value)
  if (k) editor.transport.seek(clip.start + k.t)
}

function toggleInterp() {
  const k = onKey.value
  if (!k) return
  editor.exec({
    type: 'setKeyframe',
    clipId: clip.id,
    prop,
    t: k.t,
    v: k.v,
    interp: k.interp === 'hold' ? 'linear' : 'hold',
  })
  editor.store.breakMerge()
}
</script>

<template>
  <div class="flex items-center gap-1">
    <KNumberField
      v-model="value"
      :label="label"
      :suffix="suffix"
      :min="min"
      :max="max"
      :step="step"
      :precision="precision"
      class="min-w-0 flex-1"
      :data-prop="prop"
      @commit="editor.store.breakMerge()"
    />
    <button
      class="k-icon-btn size-5! [&_svg]:size-3!"
      :disabled="!animated"
      :aria-label="`Previous ${label} keyframe`"
      @click="jump(-1)"
    >
      <ChevronLeft />
    </button>
    <button
      class="k-icon-btn size-6!"
      :class="onKey ? 'text-[#E0A100]!' : animated ? 'text-[#E0A100]/60!' : ''"
      :aria-pressed="!!onKey"
      :disabled="!inRange"
      :aria-label="onKey ? `Remove ${label} keyframe` : `Add ${label} keyframe`"
      :title="onKey ? 'Remove keyframe' : 'Add keyframe at playhead'"
      :data-testid="`kf-${prop}`"
      @click="toggleKey"
    >
      <Diamond :fill="onKey ? 'currentColor' : 'none'" />
    </button>
    <button
      class="k-icon-btn size-5! [&_svg]:size-3!"
      :disabled="!animated"
      :aria-label="`Next ${label} keyframe`"
      @click="jump(1)"
    >
      <ChevronRight />
    </button>
    <button
      v-if="onKey"
      class="k-icon-btn w-auto! px-1 font-mono text-[10px]"
      :title="`Interpolation: ${onKey.interp}. Click to toggle.`"
      @click="toggleInterp"
    >
      {{ onKey.interp === 'hold' ? 'HOLD' : 'LIN' }}
    </button>
  </div>
</template>
