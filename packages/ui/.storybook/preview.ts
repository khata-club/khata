import type { Decorator, Preview } from '@storybook/vue3-vite'

import '../src/styles/fonts.css'
import './storybook.css'

/** Prototype "Tweaks": Motion and Depth multiply every duration and shadow in the kit. */
const MOTION = { Calm: 1, Slow: 2, Off: 0 } as const
const DEPTH = { Soft: 0.6, Standard: 1, Pronounced: 1.7 } as const

const withCalmTweaks: Decorator = (story, context) => {
  const root = document.documentElement.style
  const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  const motion = MOTION[context.globals.motion as keyof typeof MOTION] ?? 1
  const depth = DEPTH[context.globals.depth as keyof typeof DEPTH] ?? 1
  root.setProperty('--motion-scale', String(reduce ? 0 : motion))
  root.setProperty('--depth-scale', String(depth))
  return story()
}

const preview: Preview = {
  decorators: [withCalmTweaks],
  globalTypes: {
    motion: {
      description: 'Animation speed for the whole kit',
      toolbar: {
        title: 'Motion',
        icon: 'lightning',
        items: ['Calm', 'Slow', 'Off'],
        dynamicTitle: true,
      },
    },
    depth: {
      description: 'Shadow strength for the whole kit',
      toolbar: {
        title: 'Depth',
        icon: 'contrast',
        items: ['Soft', 'Standard', 'Pronounced'],
        dynamicTitle: true,
      },
    },
  },
  initialGlobals: { motion: 'Calm', depth: 'Standard' },
  parameters: {
    layout: 'padded',
    controls: { expanded: true },
    a11y: { test: 'error' },
    options: {
      storySort: {
        order: ['Foundations', 'Atoms', 'Molecules', 'Organisms', 'Patterns', 'Charts', 'Cards'],
      },
    },
  },
}

export default preview
