import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { Sun, Volume2 } from '@lucide/vue'
import { ref } from 'vue'

import GCheckbox from './GCheckbox.vue'
import GRadio from './GRadio.vue'
import GRadioGroup from './GRadioGroup.vue'
import GSlider from './GSlider.vue'
import GSwitch from './GSwitch.vue'

const meta = { title: 'Atoms/Controls' } satisfies Meta

export default meta
type Story = StoryObj<typeof meta>

export const Switches: Story = {
  render: () => ({
    components: { GSwitch },
    setup: () => ({ a: ref(true), b: ref(false), c: ref(true) }),
    template: `
      <div class="flex max-w-[420px] flex-col rounded-xl bg-surface px-4">
        <GSwitch v-model="a" class="py-1.5">Airplane mode</GSwitch>
        <GSwitch v-model="b" tone="accent" class="py-1.5">Low data mode</GSwitch>
        <GSwitch v-model="c" disabled class="py-1.5">Managed by your organisation</GSwitch>
        <GSwitch :model-value="false" invalid class="py-1.5">Needs attention</GSwitch>
      </div>
      <p class="mt-3 text-subhead text-label-secondary">Press and hold a switch: the thumb leans before it springs across.</p>`,
  }),
}

export const Checkboxes: Story = {
  render: () => ({
    components: { GCheckbox },
    setup: () => ({
      a: ref(true),
      b: ref(false),
      c: ref<boolean | 'indeterminate'>('indeterminate'),
    }),
    template: `
      <div class="flex flex-col">
        <GCheckbox v-model="a">Email me a weekly summary</GCheckbox>
        <GCheckbox v-model="b">Include settled khatas</GCheckbox>
        <GCheckbox v-model="c">Select all members</GCheckbox>
        <GCheckbox :model-value="false" invalid>I agree to the terms</GCheckbox>
        <GCheckbox :model-value="true" disabled>Required by your plan</GCheckbox>
      </div>`,
  }),
}

export const Radios: Story = {
  render: () => ({
    components: { GRadio, GRadioGroup },
    setup: () => ({ v: ref('even') }),
    template: `
      <GRadioGroup v-model="v" name="split">
        <GRadio value="even">Split evenly</GRadio>
        <GRadio value="shares">By shares</GRadio>
        <GRadio value="exact">Exact amounts</GRadio>
        <GRadio value="none" disabled>Percentages (soon)</GRadio>
      </GRadioGroup>`,
  }),
}

export const Sliders: Story = {
  parameters: { backdrop: 'Wallpaper' },
  render: () => ({
    components: { GSlider, Sun, Volume2 },
    setup: () => ({ a: ref(64), b: ref(30) }),
    template: `
      <div class="glass-regular flex max-w-[380px] flex-col gap-1 rounded-xl px-5 py-3">
        <div class="flex items-center gap-3"><Sun :size="18" class="text-label-secondary" aria-hidden="true" /><GSlider v-model="a" label="Brightness" /></div>
        <div class="flex items-center gap-3"><Volume2 :size="18" class="text-label-secondary" aria-hidden="true" /><GSlider v-model="b" label="Volume" /></div>
        <span class="text-footnote text-label-secondary tabular-nums">Brightness {{ a }} · Volume {{ b }}</span>
      </div>`,
  }),
}
