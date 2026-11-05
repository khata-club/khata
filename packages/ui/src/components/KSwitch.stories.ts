import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { ref } from 'vue'

import KSwitch from './KSwitch.vue'

const meta = {
  title: 'Atoms/Switch',
  component: KSwitch,
  args: { disabled: false },
  render: (args) => ({
    components: { KSwitch },
    setup: () => ({ args, on: ref(true) }),
    template: '<KSwitch v-bind="args" v-model="on">Notifications</KSwitch>',
  }),
} satisfies Meta<typeof KSwitch>

export default meta
type Story = StoryObj<typeof meta>

export const Playground: Story = {}

export const States: Story = {
  render: () => ({
    components: { KSwitch },
    setup: () => ({ notify: ref(true), autosave: ref(false) }),
    template: `
      <div class="flex flex-col gap-1">
        <KSwitch v-model="notify">Notifications</KSwitch>
        <KSwitch v-model="autosave">Auto-save</KSwitch>
        <KSwitch :model-value="true" disabled>Locked</KSwitch>
      </div>`,
  }),
}
