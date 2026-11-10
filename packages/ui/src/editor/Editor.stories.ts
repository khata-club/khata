import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { ref } from 'vue'

import KColorField from './KColorField.vue'
import KKbd from './KKbd.vue'
import KNumberField from './KNumberField.vue'
import KSlider from './KSlider.vue'
import KSplitter from './KSplitter.vue'
import KSplitterHandle from './KSplitterHandle.vue'
import KSplitterPanel from './KSplitterPanel.vue'

const meta = {
  title: 'Editor/Controls',
  component: KNumberField,
} satisfies Meta<typeof KNumberField>

export default meta
type Story = StoryObj<typeof meta>

export const Inspector: Story = {
  render: () => ({
    components: { KNumberField, KSlider, KColorField, KKbd },
    setup: () => ({
      x: ref(0),
      y: ref(-120),
      scale: ref(100),
      rot: ref(0),
      op: ref(80),
      color: ref('#2457D6'),
    }),
    template: `
      <div class="flex w-72 flex-col gap-3 rounded-md border border-line bg-surface p-4">
        <div class="grid grid-cols-2 gap-2">
          <KNumberField v-model="x" label="X" suffix="px" />
          <KNumberField v-model="y" label="Y" suffix="px" />
          <KNumberField v-model="scale" label="Scale" suffix="%" :min="0" />
          <KNumberField v-model="rot" label="Rot" suffix="°" :precision="1" :step="0.5" />
        </div>
        <div class="flex items-center gap-3 text-xs text-fg-muted">
          Opacity <KSlider v-model="op" label="Opacity" /> <span class="w-8 text-right font-mono">{{ op }}</span>
        </div>
        <KColorField v-model="color" label="Colour" />
        <p class="m-0 text-xs text-fg-muted">Split <KKbd>S</KKbd> · Undo <KKbd>⌘</KKbd><KKbd>Z</KKbd></p>
      </div>`,
  }),
}

export const Splitter: Story = {
  render: () => ({
    components: { KSplitter, KSplitterPanel, KSplitterHandle },
    template: `
      <div class="h-80 rounded-md border border-line">
        <KSplitter direction="vertical">
          <KSplitterPanel :default-size="60">
            <KSplitter>
              <KSplitterPanel :default-size="25" :min-size="15" class="p-3 text-sm">Media</KSplitterPanel>
              <KSplitterHandle />
              <KSplitterPanel :default-size="50" class="grid place-items-center bg-gray-900 text-sm text-white">Preview</KSplitterPanel>
              <KSplitterHandle />
              <KSplitterPanel :default-size="25" :min-size="15" class="p-3 text-sm">Inspector</KSplitterPanel>
            </KSplitter>
          </KSplitterPanel>
          <KSplitterHandle />
          <KSplitterPanel :default-size="40" class="p-3 text-sm">Timeline</KSplitterPanel>
        </KSplitter>
      </div>`,
  }),
}
