import { clsx, type ClassValue } from 'clsx'
import { extendTailwindMerge } from 'tailwind-merge'

// Teach tailwind-merge the Calm-specific theme keys so e.g. `text-display` and `text-sm` are
// recognised as conflicting font sizes rather than colours, and a `class="animate-none"` override
// replaces a component's `animate-ck-rise`. Keep in sync with styles/theme.css.
const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      text: ['display'],
      tracking: ['label', 'eyebrow'],
      ease: ['standard', 'spring'],
      animate: [
        'ck-spin',
        'ck-pulse',
        'ck-indeterminate',
        'ck-rise',
        'ck-shake',
        'ck-pop-in',
        'ck-pop-out',
        'ck-fade-in',
        'ck-fade-out',
        'ck-dialog-in',
        'ck-dialog-out',
        'ck-collapse-down',
        'ck-collapse-up',
      ],
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
