import { clsx, type ClassValue } from 'clsx'
import { extendTailwindMerge } from 'tailwind-merge'

// Teach tailwind-merge the Calm-specific theme keys so e.g. `text-display` and `text-sm`
// are recognised as conflicting font sizes rather than colours.
const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      text: ['display'],
      shadow: [
        'raised-sm',
        'raised',
        'recessed',
        'floating',
        'primary-sm',
        'primary-raised',
        'primary-hover',
        'primary-pressed',
        'danger-raised',
        'thumb',
        'focus-halo',
        'recessed-focus',
        'recessed-danger-focus',
        'switch-on',
        'recessed-warning-focus',
        'raised-sm-focus',
      ],
    },
  },
})

/** Merge class lists, letting later Tailwind utilities override earlier conflicting ones. */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}
