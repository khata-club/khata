import { cva, type VariantProps } from 'class-variance-authority'

export const buttonVariants = cva(
  [
    'inline-flex shrink-0 cursor-pointer items-center justify-center gap-2 rounded-full border font-semibold whitespace-nowrap select-none',
    'transition-[background-color,border-color,color,box-shadow,translate,scale] duration-(--duration-normal) ease-standard',
    'active:scale-[0.98] data-disabled:cursor-not-allowed data-disabled:active:scale-100',
    '[&_svg]:pointer-events-none [&_svg]:shrink-0',
  ],
  {
    // `data-disabled` (set by KButton) rather than :enabled/:disabled, which only match form
    // controls: links and `asChild` buttons need the same hover and disabled styles.
    variants: {
      variant: {
        primary: [
          'border-transparent bg-primary text-on-primary shadow-primary-raised',
          'not-data-disabled:hover:-translate-y-px not-data-disabled:hover:bg-primary-hover not-data-disabled:hover:shadow-primary-hover',
          'not-data-disabled:active:translate-y-0 not-data-disabled:active:bg-primary-pressed not-data-disabled:active:shadow-primary-pressed',
        ],
        secondary: [
          'border-primary-soft bg-surface text-primary shadow-raised-sm',
          'not-data-disabled:hover:-translate-y-px not-data-disabled:hover:border-primary-accent not-data-disabled:hover:shadow-raised',
          'not-data-disabled:active:translate-y-0 not-data-disabled:active:bg-surface-subtle not-data-disabled:active:shadow-recessed',
        ],
        outline: [
          'border-line-control bg-transparent text-fg',
          'not-data-disabled:hover:border-primary not-data-disabled:hover:text-primary not-data-disabled:active:bg-primary-subtle',
        ],
        ghost: [
          'border-transparent bg-transparent text-primary',
          'not-data-disabled:hover:bg-primary-subtle not-data-disabled:active:bg-primary-soft',
        ],
        neutral: [
          'border-line bg-surface text-fg shadow-raised-sm',
          'not-data-disabled:hover:-translate-y-px not-data-disabled:hover:shadow-raised not-data-disabled:active:translate-y-0 not-data-disabled:active:shadow-recessed',
        ],
        danger: [
          'border-transparent bg-danger text-on-primary shadow-danger-raised',
          'not-data-disabled:hover:-translate-y-px not-data-disabled:hover:bg-danger-hover',
          'not-data-disabled:active:translate-y-0 not-data-disabled:active:bg-danger-pressed not-data-disabled:active:shadow-primary-pressed',
        ],
      },
      size: {
        sm: 'h-9 px-4 text-sm [&_svg]:size-4',
        md: 'h-12 px-6 text-base [&_svg]:size-5',
        lg: 'h-14 px-8 text-lg [&_svg]:size-5',
      },
      iconOnly: { true: 'px-0' },
    },
    compoundVariants: [
      { variant: 'primary', size: 'sm', class: 'shadow-primary-sm' },
      { size: 'sm', iconOnly: true, class: 'w-9' },
      { size: 'md', iconOnly: true, class: 'w-12 [&_svg]:size-[22px]' },
      { size: 'lg', iconOnly: true, class: 'w-14 [&_svg]:size-6' },
      // Disabled: solid variants sit flat in a recessed well; outline-style variants go dashed.
      {
        variant: ['primary', 'secondary', 'neutral', 'danger'],
        class:
          'data-disabled:border-line data-disabled:bg-surface-recessed data-disabled:text-fg-disabled data-disabled:shadow-none',
      },
      {
        variant: ['outline', 'ghost'],
        class:
          'data-disabled:border-dashed data-disabled:border-line-control data-disabled:bg-transparent data-disabled:text-fg-disabled',
      },
    ],
    defaultVariants: { variant: 'primary', size: 'md', iconOnly: false },
  },
)

export type ButtonVariants = VariantProps<typeof buttonVariants>
