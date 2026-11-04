import type { Meta, StoryObj } from '@storybook/vue3-vite'

import ColorPalette from './ColorPalette.vue'
import ElevationScale from './ElevationScale.vue'
import MotionTokens from './MotionTokens.vue'
import SpacingRadii from './SpacingRadii.vue'
import TypeScale from './TypeScale.vue'

const meta = {
  title: 'Foundations',
  parameters: { layout: 'padded' },
} satisfies Meta

export default meta
type Story = StoryObj<typeof meta>

export const Color: Story = {
  render: () => ({ components: { ColorPalette }, template: '<ColorPalette />' }),
}
export const Typography: Story = {
  render: () => ({ components: { TypeScale }, template: '<TypeScale />' }),
}
export const SpacingAndRadii: Story = {
  name: 'Spacing & radii',
  render: () => ({ components: { SpacingRadii }, template: '<SpacingRadii />' }),
}
export const Elevations: Story = {
  name: 'Elevation',
  render: () => ({ components: { ElevationScale }, template: '<ElevationScale />' }),
}
export const Motion: Story = {
  name: 'Motion',
  render: () => ({ components: { MotionTokens }, template: '<MotionTokens />' }),
}
