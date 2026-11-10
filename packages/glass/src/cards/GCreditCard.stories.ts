import type { Meta, StoryObj } from '@storybook/vue3-vite'

import CardsShowcase from './CardsShowcase.vue'
import GCreditCard from './GCreditCard.vue'

const meta = {
  title: 'Cards/Credit card',
  component: GCreditCard,
  argTypes: { color: { control: 'color' } },
  args: {
    color: '#1C1C1E',
    bankName: 'khata',
    tagline: 'Card',
    holder: 'Diego van Dijk',
    number: '4000 1234 5678 9010',
    showNumber: false,
    expiry: '08/28',
    network: 'Network',
    tier: 'Platinum',
    tilt: true,
  },
  render: (args) => ({
    components: { GCreditCard },
    setup: () => ({ args }),
    template: '<div class="w-[340px]"><GCreditCard v-bind="args" /></div>',
  }),
} satisfies Meta<typeof GCreditCard>

export default meta
type Story = StoryObj<typeof meta>

/** Pick any colour in Controls; the ink flips between light and dark by contrast. */
export const Playground: Story = {}
export const Pale: Story = { args: { color: '#EFEBE4', tier: 'Infinite' } }
export const MidTone: Story = { args: { color: '#8FA7C4', tier: 'Standard' } }

/** A hex field and colour picker, plus a Wallet stack of presets. */
export const Showcase: Story = {
  render: () => ({ components: { CardsShowcase }, template: '<CardsShowcase />' }),
}
