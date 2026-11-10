import type { Meta, StoryObj } from '@storybook/vue3-vite'

import KBadge from './KBadge.vue'

const meta = {
  title: 'Atoms/Badge',
  component: KBadge,
  argTypes: {
    tone: { control: 'select', options: ['neutral', 'primary', 'success', 'warning', 'danger'] },
  },
  args: { tone: 'primary', dot: true },
  render: (args) => ({
    components: { KBadge },
    setup: () => ({ args }),
    template: '<KBadge v-bind="args">Primary</KBadge>',
  }),
} satisfies Meta<typeof KBadge>

export default meta
type Story = StoryObj<typeof meta>

export const Playground: Story = {}

export const Tones: Story = {
  render: () => ({
    components: { KBadge },
    template: `
      <div class="flex flex-wrap gap-3">
        <KBadge tone="neutral">Neutral</KBadge>
        <KBadge tone="primary">Primary</KBadge>
        <KBadge tone="success">Success</KBadge>
        <KBadge tone="warning">Warning</KBadge>
        <KBadge tone="danger">Danger</KBadge>
      </div>`,
  }),
}
