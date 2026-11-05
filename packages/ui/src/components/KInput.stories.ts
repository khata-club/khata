import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { CircleAlert } from '@lucide/vue'

import KInput from './KInput.vue'

const meta = {
  title: 'Atoms/Input',
  component: KInput,
  args: { invalid: false, disabled: false, readonly: false },
  render: (args) => ({
    components: { KInput },
    setup: () => ({ args }),
    template:
      '<KInput v-bind="args" aria-label="Example" placeholder="Type here…" class="max-w-80" />',
  }),
} satisfies Meta<typeof KInput>

export default meta
type Story = StoryObj<typeof meta>

export const Playground: Story = {}

export const States: Story = {
  render: () => ({
    components: { KInput, CircleAlert },
    template: `
      <div class="grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-5">
        <div class="flex flex-col gap-2">
          <KInput aria-label="Default input" placeholder="Type here…" />
          <span class="text-fg-muted font-mono text-xs">default · hover · focus</span>
        </div>
        <div class="flex flex-col gap-2">
          <KInput aria-label="Filled input" model-value="Olivia Bennett" />
          <span class="text-fg-muted font-mono text-xs">filled</span>
        </div>
        <div class="flex flex-col gap-2">
          <KInput aria-label="Input with error" model-value="olivia@" invalid readonly />
          <span class="text-danger flex items-center gap-1 font-mono text-xs"><CircleAlert :size="14" aria-hidden="true" />error</span>
        </div>
        <div class="flex flex-col gap-2">
          <KInput aria-label="Disabled input" placeholder="Not editable" disabled />
          <span class="text-fg-muted font-mono text-xs">disabled</span>
        </div>
      </div>`,
  }),
}
