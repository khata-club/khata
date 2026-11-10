import type { Meta, StoryObj } from '@storybook/vue3-vite'

import ChartsOverview from './ChartsOverview.vue'

/**
 * The full Charts page from the design: twenty personal-finance charts in five groups, each
 * animating in on scroll. "Replay animations" re-runs them all. Palette, animation speed and grid
 * lines are controls.
 */
const meta = {
  title: 'Charts/Overview',
  component: ChartsOverview,
  parameters: { layout: 'fullscreen' },
  argTypes: {
    palette: { control: 'inline-radio', options: ['System', 'Monochrome'] },
    animationSpeed: { control: { type: 'range', min: 0.5, max: 2, step: 0.25 } },
    showGrid: { control: 'boolean' },
  },
  args: { palette: 'System', animationSpeed: 1, showGrid: true },
} satisfies Meta<typeof ChartsOverview>

export default meta
export const Overview: StoryObj<typeof meta> = {}
export const Monochrome: StoryObj<typeof meta> = { args: { palette: 'Monochrome' } }
