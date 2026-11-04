import type { Meta, StoryObj } from '@storybook/vue3-vite'

import CardsShowcase from './CardsShowcase.vue'
import KCreditCard from './KCreditCard.vue'

const meta = {
  title: 'Cards/Credit card',
  component: KCreditCard,
  argTypes: { color: { control: 'color' } },
  args: {
    color: '#1F3A5A',
    bankName: 'Calm',
    tagline: 'Digital Bank',
    holder: 'Diego van Dijk',
    number: '4000 1234 5678 9010',
    expiry: '08/28',
    expiryLabel: 'Valid\nthru',
    network: 'Network',
    tier: 'Platinum',
  },
  render: (args) => ({
    components: { KCreditCard },
    setup: () => ({ args }),
    template: '<div class="w-[300px]"><KCreditCard v-bind="args" /></div>',
  }),
} satisfies Meta<typeof KCreditCard>

export default meta
type Story = StoryObj<typeof meta>

/** Pick any colour in Controls; the ink flips between light and dark by contrast. */
export const Playground: Story = {}
export const Pale: Story = { args: { color: '#EFEBE4', tier: 'Infinite' } }
export const MidTone: Story = { args: { color: '#8FA7C4', tier: 'Standard' } }

/** The design's showcase page: a hex field + colour picker, and eight presets. */
export const Showcase: Story = {
  parameters: { layout: 'fullscreen' },
  render: () => ({ components: { CardsShowcase }, template: '<CardsShowcase />' }),
}
