<script setup lang="ts">
import {
  type Clip,
  type Effect,
  FPS,
  type TextAlign,
  type TransitionType,
  activeSequence,
  findClip,
  formatTimecode,
  secondsToTicks,
  ticksToSeconds,
} from '@khata/kaat-core'
import {
  KColorField,
  KNumberField,
  KSegmentedControl,
  KSelect,
  KSlider,
  KSwitch,
  KTextarea,
} from '@khata/ui'
import { Trash2, Unlink } from '@lucide/vue'
import { computed } from 'vue'

import { TEXT_FONTS } from '../../engine/render/text'
import { useEditor } from '../useEditor'
import PropField from './PropField.vue'
import InspectorSection from './InspectorSection.vue'

const editor = useEditor()
const p = computed(() => editor.project.value!)
const seq = computed(() => activeSequence(p.value))
const loc = computed(() => {
  const id = editor.ui.selection[0]
  return id ? findClip(seq.value, id) : undefined
})
const clip = computed<Clip | undefined>(() => loc.value?.clip)
const onVideo = computed(() => loc.value?.track.kind === 'video')
const asset = computed(() => (clip.value?.assetId ? p.value.assets[clip.value.assetId] : undefined))
const tc = (t: number) => formatTimecode(t, p.value.settings.fps)

function patch(patch: Parameters<typeof editor.exec>[0] & object) {
  editor.exec(patch)
}

// Text
const textContent = computed({
  get: () => clip.value?.text?.content ?? '',
  set: (v: string) =>
    clip.value &&
    patch({ type: 'setClipProps', clipId: clip.value.id, patch: { text: { content: v } } }),
})
function textProp<K extends 'fontFamily' | 'fontSize' | 'fontWeight' | 'align' | 'color'>(
  k: K,
  v: unknown,
) {
  if (clip.value)
    patch({ type: 'setClipProps', clipId: clip.value.id, patch: { text: { [k]: v } } })
}

// Crop (percent)
function crop(edge: 'left' | 'top' | 'right' | 'bottom', v: number) {
  if (clip.value)
    patch({
      type: 'setClipProps',
      clipId: clip.value.id,
      patch: { crop: { [edge]: Math.max(0, Math.min(0.95, v / 100)) } },
    })
}

// Audio
function audioProp(k: 'gainDb' | 'fadeIn' | 'fadeOut', v: number) {
  if (!clip.value) return
  patch({
    type: 'setClipProps',
    clipId: clip.value.id,
    patch: { audio: { [k]: k === 'gainDb' ? v : secondsToTicks(v) } },
  })
}

// Effects
function updateEffect(e: Effect, patchE: Partial<Effect>) {
  if (clip.value)
    patch({ type: 'updateEffect', clipId: clip.value.id, effectId: e.id, patch: patchE })
}

// Transition
const transitionType = computed({
  get: () => clip.value?.transitionIn?.type ?? 'none',
  set: (v: string) => {
    if (!clip.value) return
    if (v === 'none') patch({ type: 'setTransition', clipId: clip.value.id, transition: null })
    else
      patch({
        type: 'setTransition',
        clipId: clip.value.id,
        transition: {
          type: v as TransitionType,
          duration: clip.value.transitionIn?.duration ?? secondsToTicks(1),
          color: clip.value.transitionIn?.color ?? '#000000',
        },
      })
  },
})
function transitionDuration(v: number) {
  const c = clip.value
  if (c?.transitionIn)
    patch({
      type: 'setTransition',
      clipId: c.id,
      transition: { ...c.transitionIn, duration: secondsToTicks(Math.max(1 / 30, v)) },
    })
}
function transitionColor(v: string) {
  const c = clip.value
  if (c?.transitionIn)
    patch({ type: 'setTransition', clipId: c.id, transition: { ...c.transitionIn, color: v } })
}

// Project settings
const fpsKey = computed({
  get: () =>
    Object.entries(FPS).find(
      ([, r]) => r.num * p.value.settings.fps.den === p.value.settings.fps.num * r.den,
    )?.[0] ?? '30',
  set: (k: string) =>
    editor.exec({ type: 'setSettings', patch: { fps: { ...FPS[k as keyof typeof FPS] } } }),
})
const resKey = computed({
  get: () => `${p.value.settings.width}x${p.value.settings.height}`,
  set: (k: string) => {
    const [w, h] = k.split('x').map(Number)
    editor.exec({ type: 'setSettings', patch: { width: w, height: h } })
  },
})
const resolutions = computed(() => {
  const base = ['1280x720', '1920x1080', '2560x1440', '3840x2160', '1080x1920', '1080x1080']
  if (!base.includes(resKey.value)) base.unshift(resKey.value)
  return base.map((v) => ({ value: v, label: v.replace('x', ' × ') }))
})
const fpsOptions = Object.keys(FPS).map((k) => ({ value: k, label: `${k} fps` }))
const fontOptions = TEXT_FONTS.map((f) => ({ value: f, label: f }))
const weightOptions = ['300', '400', '500', '600', '700', '800', '900'].map((v) => ({
  value: v,
  label: v,
}))
const transitionOptions = [
  { value: 'none', label: 'None' },
  { value: 'dissolve', label: 'Dissolve' },
  { value: 'slide', label: 'Slide' },
  { value: 'wipe', label: 'Wipe' },
  { value: 'fadeColor', label: 'Fade through colour' },
]
</script>

<template>
  <div class="flex h-full min-h-0 flex-col overflow-y-auto" data-testid="inspector">
    <template v-if="clip">
      <InspectorSection
        :title="
          clip.kind === 'text'
            ? 'Text clip'
            : asset?.kind === 'audio' || !onVideo
              ? 'Audio clip'
              : asset?.kind === 'image'
                ? 'Image clip'
                : 'Video clip'
        "
      >
        <template #actions>
          <button
            v-if="clip.linkId"
            class="k-icon-btn"
            title="Unlink audio/video"
            aria-label="Unlink"
            @click="editor.exec({ type: 'unlinkClips', clipIds: [clip.id] })"
          >
            <Unlink />
          </button>
          <button
            class="k-icon-btn"
            title="Delete (Del)"
            aria-label="Delete clip"
            @click="editor.deleteSelection(false)"
          >
            <Trash2 />
          </button>
        </template>
        <p class="m-0 truncate text-sm font-semibold">{{ clip.name }}</p>
        <dl
          class="m-0 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 font-mono text-[11px] text-fg-muted"
        >
          <dt>Start</dt>
          <dd class="m-0">{{ tc(clip.start) }}</dd>
          <dt>Duration</dt>
          <dd class="m-0">{{ tc(clip.duration) }}</dd>
          <template v-if="clip.kind === 'media' && asset?.kind !== 'image'">
            <dt>Source in</dt>
            <dd class="m-0">{{ tc(clip.sourceIn) }}</dd>
          </template>
        </dl>
      </InspectorSection>

      <template v-if="onVideo">
        <InspectorSection title="Transform">
          <div class="grid grid-cols-1 gap-1.5">
            <PropField :clip="clip" prop="x" label="X" suffix="px" />
            <PropField :clip="clip" prop="y" label="Y" suffix="px" />
            <PropField
              :clip="clip"
              prop="scale"
              label="Scale"
              suffix="%"
              :factor="100"
              :min="0"
              :max="2000"
            />
            <PropField
              :clip="clip"
              prop="rotation"
              label="Rotate"
              suffix="°"
              :precision="1"
              :step="0.5"
            />
            <PropField
              :clip="clip"
              prop="opacity"
              label="Opacity"
              suffix="%"
              :factor="100"
              :min="0"
              :max="100"
            />
          </div>
          <button
            class="self-start text-[11px] font-semibold text-primary hover:underline"
            @click="
              editor.exec({
                type: 'setClipProps',
                clipId: clip.id,
                patch: { transform: { x: 0, y: 0, scale: 1, rotation: 0, opacity: 1 } },
              })
            "
          >
            Reset transform
          </button>
        </InspectorSection>

        <InspectorSection v-if="clip.kind === 'media'" title="Crop">
          <div class="grid grid-cols-2 gap-1.5">
            <KNumberField
              :model-value="clip.crop.left * 100"
              label="L"
              suffix="%"
              :min="0"
              :max="95"
              @update:model-value="(v: number) => crop('left', v)"
              @commit="editor.store.breakMerge()"
            />
            <KNumberField
              :model-value="clip.crop.right * 100"
              label="R"
              suffix="%"
              :min="0"
              :max="95"
              @update:model-value="(v: number) => crop('right', v)"
              @commit="editor.store.breakMerge()"
            />
            <KNumberField
              :model-value="clip.crop.top * 100"
              label="T"
              suffix="%"
              :min="0"
              :max="95"
              @update:model-value="(v: number) => crop('top', v)"
              @commit="editor.store.breakMerge()"
            />
            <KNumberField
              :model-value="clip.crop.bottom * 100"
              label="B"
              suffix="%"
              :min="0"
              :max="95"
              @update:model-value="(v: number) => crop('bottom', v)"
              @commit="editor.store.breakMerge()"
            />
          </div>
        </InspectorSection>

        <InspectorSection v-if="clip.kind === 'text' && clip.text" title="Typography">
          <KTextarea v-model="textContent" label="Text" :rows="3" data-testid="text-content" />
          <KSelect
            :model-value="clip.text.fontFamily"
            :options="fontOptions"
            aria-label="Font"
            class="h-8! rounded-sm! px-2! text-xs!"
            @update:model-value="(v) => textProp('fontFamily', v)"
          />
          <div class="grid grid-cols-2 gap-1.5">
            <KNumberField
              :model-value="clip.text.fontSize"
              label="Size"
              suffix="px"
              :min="4"
              :max="1000"
              @update:model-value="(v: number) => textProp('fontSize', v)"
              @commit="editor.store.breakMerge()"
            />
            <KSelect
              :model-value="String(clip.text.fontWeight)"
              :options="weightOptions"
              aria-label="Weight"
              class="h-7! rounded-sm! px-2! text-xs!"
              @update:model-value="(v) => textProp('fontWeight', Number(v))"
            />
          </div>
          <KSegmentedControl
            :model-value="clip.text.align"
            label="Alignment"
            size="sm"
            :options="[
              { value: 'left', label: 'Left' },
              { value: 'center', label: 'Centre' },
              { value: 'right', label: 'Right' },
            ]"
            @update:model-value="(v) => textProp('align', v as TextAlign)"
          />
          <KColorField
            :model-value="clip.text.color"
            label="Text colour"
            @update:model-value="(v: string) => textProp('color', v)"
            @commit="editor.store.breakMerge()"
          />
        </InspectorSection>

        <InspectorSection title="Effects">
          <p v-if="!clip.effects.length" class="m-0 text-[11px] text-fg-muted">
            Add effects from the Effects tab.
          </p>
          <div
            v-for="e in clip.effects"
            :key="e.id"
            class="flex flex-col gap-1.5 rounded-md border border-line p-2"
          >
            <div class="flex items-center gap-2">
              <span class="flex-1 text-xs font-semibold">{{
                e.type === 'color' ? 'Colour adjust' : 'Blur'
              }}</span>
              <KSwitch
                :model-value="e.enabled"
                class="min-h-0! scale-75"
                :aria-label="`Enable ${e.type}`"
                @update:model-value="(v: boolean) => updateEffect(e, { enabled: v })"
              />
              <button
                class="k-icon-btn"
                aria-label="Remove effect"
                @click="editor.exec({ type: 'removeEffect', clipId: clip.id, effectId: e.id })"
              >
                <Trash2 />
              </button>
            </div>
            <template v-if="e.type === 'color'">
              <label
                v-for="k in ['brightness', 'contrast', 'saturation'] as const"
                :key="k"
                class="grid grid-cols-[72px_1fr_36px] items-center gap-2 text-[11px] text-fg-muted"
              >
                <span class="capitalize">{{ k }}</span>
                <KSlider
                  :model-value="e[k] * 100"
                  :min="-100"
                  :max="100"
                  :label="k"
                  @update:model-value="(v: number) => updateEffect(e, { [k]: v / 100 })"
                  @commit="editor.store.breakMerge()"
                />
                <span class="text-right font-mono">{{ Math.round(e[k] * 100) }}</span>
              </label>
            </template>
            <label
              v-else
              class="grid grid-cols-[72px_1fr_36px] items-center gap-2 text-[11px] text-fg-muted"
            >
              <span>Radius</span>
              <KSlider
                :model-value="e.radius"
                :min="0"
                :max="100"
                label="Blur radius"
                @update:model-value="(v: number) => updateEffect(e, { radius: v })"
                @commit="editor.store.breakMerge()"
              />
              <span class="text-right font-mono">{{ e.radius }}</span>
            </label>
          </div>
        </InspectorSection>

        <InspectorSection title="Transition in">
          <KSelect
            v-model="transitionType"
            :options="transitionOptions"
            aria-label="Transition"
            class="h-8! rounded-sm! px-2! text-xs!"
            data-testid="transition-select"
          />
          <template v-if="clip.transitionIn">
            <KNumberField
              :model-value="ticksToSeconds(clip.transitionIn.duration)"
              label="Duration"
              suffix="s"
              :min="0.03"
              :max="ticksToSeconds(clip.duration)"
              :step="0.05"
              :precision="2"
              @update:model-value="transitionDuration"
              @commit="editor.store.breakMerge()"
            />
            <KColorField
              v-if="clip.transitionIn.type === 'fadeColor'"
              :model-value="clip.transitionIn.color ?? '#000000'"
              label="Colour"
              @update:model-value="transitionColor"
            />
          </template>
        </InspectorSection>
      </template>

      <InspectorSection v-else title="Audio">
        <KNumberField
          :model-value="clip.audio.gainDb"
          label="Gain"
          suffix="dB"
          :min="-60"
          :max="24"
          :step="0.5"
          :precision="1"
          @update:model-value="(v: number) => audioProp('gainDb', v)"
          @commit="editor.store.breakMerge()"
        />
        <div class="grid grid-cols-2 gap-1.5">
          <KNumberField
            :model-value="ticksToSeconds(clip.audio.fadeIn)"
            label="Fade in"
            suffix="s"
            :min="0"
            :step="0.05"
            :precision="2"
            @update:model-value="(v: number) => audioProp('fadeIn', v)"
            @commit="editor.store.breakMerge()"
          />
          <KNumberField
            :model-value="ticksToSeconds(clip.audio.fadeOut)"
            label="Fade out"
            suffix="s"
            :min="0"
            :step="0.05"
            :precision="2"
            @update:model-value="(v: number) => audioProp('fadeOut', v)"
            @commit="editor.store.breakMerge()"
          />
        </div>
      </InspectorSection>
    </template>

    <template v-else>
      <InspectorSection title="Project">
        <label class="k-field-label" for="prj-name">Name</label>
        <input
          id="prj-name"
          class="h-8 rounded-sm border border-line bg-surface px-2 text-sm outline-none focus:border-primary"
          :value="p.name"
          @change="
            (e) =>
              editor.exec({
                type: 'renameProject',
                name: (e.target as HTMLInputElement).value || 'Untitled project',
              })
          "
        />
        <span class="k-field-label">Resolution</span>
        <KSelect
          v-model="resKey"
          :options="resolutions"
          aria-label="Resolution"
          class="h-8! rounded-sm! px-2! text-xs!"
        />
        <span class="k-field-label">Frame rate</span>
        <KSelect
          v-model="fpsKey"
          :options="fpsOptions"
          aria-label="Frame rate"
          class="h-8! rounded-sm! px-2! text-xs!"
        />
        <span class="k-field-label">Background</span>
        <KColorField
          :model-value="p.settings.background"
          label="Background"
          @update:model-value="
            (v: string) => editor.exec({ type: 'setSettings', patch: { background: v } })
          "
        />
      </InspectorSection>
      <InspectorSection title="Selection">
        <p class="m-0 text-xs text-fg-muted">
          Select a clip on the timeline to edit its properties.
        </p>
      </InspectorSection>
    </template>
  </div>
</template>
