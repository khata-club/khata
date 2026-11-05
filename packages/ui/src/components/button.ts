import { cva, type VariantProps } from 'class-variance-authority'

export const buttonVariants = cva(
  [
    'inline-flex shrink-0 cursor-pointer items-center justify-center gap-2 rounded-full border font-semibold whitespace-nowrap select-none',
    'transition-[background-color,border-color,color,box-shadow,transform] duration-(--duration-normal) ease-standard',
    'active:scale-[0.98] disabled:cursor-not-allowed disabled:active:scale-100',
    '[&_svg]:pointer-events-none [&_svg]:shrink-0',
  ],
  {
    variants: {
      variant: {
        primary: [
          'border-transparent bg-primary text-on-primary shadow-primary-raised',
          'enabled:hover:-translate-y-px enabled:hover:bg-primary-hover enabled:hover:shadow-primary-hover',
          'enabled:active:translate-y-0 enabled:active:bg-primary-pressed enabled:active:shadow-primary-pressed',
        ],
        secondary: [
          'border-primary-soft bg-surface text-primary shadow-raised-sm',
          'enabled:hover:-translate-y-px enabled:hover:border-primary-accent enabled:hover:shadow-raised',
          'enabled:active:translate-y-0 enabled:active:bg-surface-subtle enabled:active:shadow-recessed',
        ],
        outline: [
          'border-line-control bg-transparent text-fg',
          'enabled:hover:border-primary enabled:hover:text-primary enabled:active:bg-primary-subtle',
        ],
        ghost: [
          'border-transparent bg-transparent text-primary',
          'enabled:hover:bg-primary-subtle enabled:active:bg-primary-soft',
        ],
        neutral: [
          'border-line bg-surface text-fg shadow-raised-sm',
          'enabled:hover:-translate-y-px enabled:hover:shadow-raised enabled:active:translate-y-0 enabled:active:shadow-recessed',
        ],
        danger: [
          'border-transparent bg-danger text-on-primary shadow-danger-raised',
          'enabled:hover:-translate-y-px enabled:hover:bg-danger-hover',
          'enabled:active:translate-y-0 enabled:active:bg-danger-pressed enabled:active:shadow-primary-pressed',
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
          'disabled:border-line disabled:bg-surface-recessed disabled:text-fg-disabled disabled:shadow-none',
      },
      {
        variant: ['outline', 'ghost'],
        class:
          'disabled:border-dashed disabled:border-line-control disabled:bg-transparent disabled:text-fg-disabled',
      },
    ],
    defaultVariants: { variant: 'primary', size: 'md', iconOnly: false },
  },
)

export type ButtonVariants = VariantProps<typeof buttonVariants>
