import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { ref } from 'vue'

import KRadio from './KRadio.vue'
import KRadioGroup from './KRadioGroup.vue'

const meta = {
  title: 'Atoms/Radio group',
  component: KRadioGroup,
  args: { disabled: false, orientation: 'vertical' },
  argTypes: { orientation: { control: 'inline-radio', options: ['vertical', 'horizontal'] } },
  render: (args) => ({
    components: { KRadioGroup, KRadio },
    setup: () => ({ args, plan: ref('monthly') }),
    template: `
      <KRadioGroup v-bind="args" v-model="plan" aria-label="Billing cycle">
        <KRadio value="monthly">Monthly</KRadio>
        <KRadio value="yearly">Yearly · save 20%</KRadio>
        <KRadio value="lifetime" disabled>Lifetime (sold out)</KRadio>
      </KRadioGroup>`,
  }),
} satisfies Meta<typeof KRadioGroup>

export default meta
export const Playground: StoryObj<typeof meta> = {}
