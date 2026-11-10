<script setup lang="ts">
import { type TransitionType, findClip, newId, secondsToTicks } from '@khata/kaat-core'
import {
  Blend,
  Droplets,
  MoveHorizontal,
  Palette,
  SlidersHorizontal,
  SquareSplitHorizontal,
} from '@lucide/vue'
import { computed } from 'vue'

import { useEditor } from '../useEditor'

const editor = useEditor()

const target = computed(() => {
  const p = editor.project.value
  const id = editor.ui.selection[0]
  if (!p || !id) return undefined
  const seq = p.sequences.find((s) => s.id === p.activeSequenceId)!
  const loc = findClip(seq, id)
  return loc && loc.track.kind === 'video' ? loc.clip : undefined
})

function addColor() {
  if (!target.value) return
  editor.exec({
    type: 'addEffect',
    clipId: target.value.id,
    effect: {
      id: newId('fx'),
      type: 'color',
      enabled: true,
      brightness: 0,
      contrast: 0,
      saturation: 0,
    },
  })
}
function addBlur() {
  if (!target.value) return
  editor.exec({
    type: 'addEffect',
    clipId: target.value.id,
    effect: { id: newId('fx'), type: 'blur', enabled: true, radius: 8 },
  })
}
function transition(type: TransitionType) {
  if (!target.value) return
  editor.exec({
    type: 'setTransition',
    clipId: target.value.id,
    transition: {
      type,
      duration: secondsToTicks(1),
      color: type === 'fadeColor' ? '#000000' : undefined,
    },
  })
}

const transitions: { type: TransitionType; label: string; icon: unknown }[] = [
  { type: 'dissolve', label: 'Dissolve', icon: Blend },
  { type: 'slide', label: 'Slide', icon: MoveHorizontal },
  { type: 'wipe', label: 'Wipe', icon: SquareSplitHorizontal },
  { type: 'fadeColor', label: 'Fade through colour', icon: Palette },
]
</script>

<template>
  <div class="flex flex-col gap-4 p-3">
    <p v-if="!target" class="m-0 rounded-md bg-surface-recessed p-3 text-xs text-fg-muted">
      Select a clip on a video track to apply effects and transitions.
    </p>
    <section class="flex flex-col gap-2">
      <h3 class="k-panel-title">Effects</h3>
      <button class="fx-btn" :disabled="!target" data-testid="fx-color" @click="addColor">
        <SlidersHorizontal />Colour adjust
      </button>
      <button class="fx-btn" :disabled="!target" data-testid="fx-blur" @click="addBlur">
        <Droplets />Blur
      </button>
    </section>
    <section class="flex flex-col gap-2">
      <h3 class="k-panel-title">Transitions</h3>
      <p class="m-0 text-[11px] text-fg-muted">
        Applied at the head of the selected clip, blending from the clip before it.
      </p>
      <button
        v-for="t in transitions"
        :key="t.type"
        class="fx-btn"
        :disabled="!target"
        :data-testid="`tr-${t.type}`"
        @click="transition(t.type)"
      >
        <component :is="t.icon" />{{ t.label }}
      </button>
    </section>
  </div>
</template>

<style scoped>
@reference '../../assets/main.css';
.fx-btn {
  @apply flex cursor-pointer items-center gap-2 rounded-md border border-line bg-surface px-3 py-2 text-left text-sm font-semibold hover:border-primary-accent hover:bg-primary-subtle disabled:cursor-not-allowed disabled:opacity-50 [&_svg]:size-4 [&_svg]:text-primary;
}
</style>
