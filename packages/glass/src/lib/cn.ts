import { clsx, type ClassValue } from 'clsx'
import { extendTailwindMerge } from 'tailwind-merge'

// Teach tailwind-merge the Glass theme keys, so e.g. `text-body` and `text-caption` are seen as
// conflicting font sizes (not colours) and `glass-thin` / `glass-thick` as one material.
const twMerge = extendTailwindMerge<'glass'>({
  extend: {
    theme: {
      text: [
        'caption-2',
        'caption',
        'footnote',
        'subhead',
        'callout',
        'body',
        'title-3',
        'title-2',
        'title-1',
        'large-title',
        'display',
      ],
      shadow: ['card', 'lift', 'thumb'],
    },
    classGroups: {
      glass: ['glass-thin', 'glass-regular', 'glass-thick', 'glass-tinted'],
    },
  },
})

/** Merge class lists, letting later Tailwind utilities override earlier conflicting ones. */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}
