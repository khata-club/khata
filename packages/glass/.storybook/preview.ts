import type { Decorator, Preview } from '@storybook/vue3-vite'

import '../src/styles/fonts.css'
import './storybook.css'

/** Motion multiplies every duration; Theme pins light/dark; Backdrop shows glass over content. */
const MOTION = { Spring: 1, Slow: 3, Off: 0 } as const

const withGlass: Decorator = (story, context) => {
  const root = document.documentElement
  const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  const motion = MOTION[context.globals.motion as keyof typeof MOTION] ?? 1
  root.style.setProperty('--motion-scale', String(reduce ? 0 : motion))
  const theme = context.globals.theme as string
  if (theme === 'Light' || theme === 'Dark') root.setAttribute('data-theme', theme.toLowerCase())
  else root.removeAttribute('data-theme')
  const backdrop = (context.parameters.backdrop as string) ?? context.globals.backdrop ?? 'Plain'
  return {
    components: { story },
    template: `<div class="sb-backdrop font-sans" data-backdrop="${backdrop}"><story /></div>`,
  }
}

const preview: Preview = {
  decorators: [withGlass],
  globalTypes: {
    theme: {
      description: 'Light or dark appearance',
      toolbar: {
        title: 'Theme',
        icon: 'mirror',
        items: ['Auto', 'Light', 'Dark'],
        dynamicTitle: true,
      },
    },
    backdrop: {
      description: 'What sits behind the story',
      toolbar: {
        title: 'Backdrop',
        icon: 'photo',
        items: ['Plain', 'Wallpaper', 'Content'],
        dynamicTitle: true,
      },
    },
    motion: {
      description: 'Animation speed for the whole kit',
      toolbar: {
        title: 'Motion',
        icon: 'lightning',
        items: ['Spring', 'Slow', 'Off'],
        dynamicTitle: true,
      },
    },
  },
  initialGlobals: { theme: 'Auto', backdrop: 'Plain', motion: 'Spring' },
  parameters: {
    layout: 'fullscreen',
    controls: { expanded: true },
    a11y: { test: 'error' },
    options: {
      storySort: {
        order: [
          'Foundations',
          'Atoms',
          'Molecules',
          'Forms',
          'Patterns',
          'Charts',
          ['Overview', 'Trends', 'Spending', 'Cash flow', 'Goals & health', 'Investing & planning'],
          'Cards',
        ],
      },
    },
  },
}

export default preview
