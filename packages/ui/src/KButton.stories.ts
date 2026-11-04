import type { Meta, StoryObj } from '@storybook/vue3-vite'

import KButton from './KButton.vue'

const meta = {
  title: 'KButton',
  component: KButton,
  render: (args) => ({
    components: { KButton },
    setup: () => ({ args }),
    template: '<KButton v-bind="args">Button</KButton>',
  }),
} satisfies Meta<typeof KButton>

export default meta

export const Default: StoryObj<typeof meta> = {}
