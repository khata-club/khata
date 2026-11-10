import type { Meta, StoryObj } from '@storybook/vue3-vite'

import ColorPalette from './ColorPalette.vue'
import GlassMaterials from './GlassMaterials.vue'
import MotionTokens from './MotionTokens.vue'
import ShapeRadii from './ShapeRadii.vue'
import TypeScale from './TypeScale.vue'

const meta = { title: 'Foundations' } satisfies Meta

export default meta
type Story = StoryObj<typeof meta>

export const Color: Story = {
  render: () => ({ components: { ColorPalette }, template: '<ColorPalette />' }),
}
export const Material: Story = {
  parameters: { backdrop: 'Wallpaper' },
  render: () => ({ components: { GlassMaterials }, template: '<GlassMaterials />' }),
}
export const Typography: Story = {
  render: () => ({ components: { TypeScale }, template: '<TypeScale />' }),
}
export const Shape: Story = {
  render: () => ({ components: { ShapeRadii }, template: '<ShapeRadii />' }),
}
export const Motion: Story = {
  render: () => ({ components: { MotionTokens }, template: '<MotionTokens />' }),
}
