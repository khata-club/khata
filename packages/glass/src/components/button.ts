import { cva, type VariantProps } from 'class-variance-authority'

/*
 * Buttons press in quickly and spring back on release: `active:` shortens the duration so the
 * scale-down is immediate, and the base transition (bouncy spring) carries the release.
 */
export const buttonVariants = cva(
  [
    'relative inline-flex shrink-0 cursor-pointer items-center justify-center gap-2 rounded-full font-semibold whitespace-nowrap no-underline select-none',
    'transition-[scale,background-color,color,box-shadow,filter] duration-(--duration-spring) ease-bouncy',
    'active:scale-[0.96] active:duration-(--duration-fast) active:ease-out',
    'disabled:cursor-not-allowed disabled:opacity-40 disabled:active:scale-100 aria-disabled:pointer-events-none aria-disabled:opacity-40',
    '[&_svg]:pointer-events-none [&_svg]:shrink-0',
  ],
  {
    variants: {
      variant: {
        /** The one prominent action: tinted glass in the accent colour. */
        filled: 'glass-tinted text-on-accent hover:brightness-[1.08] active:brightness-[1.15]',
        /** Floats over content: clear glass with label-coloured text. */
        glass: 'glass-thin text-label hover:brightness-[1.04] active:brightness-[1.1]',
        /** Secondary on a surface: soft accent wash. */
        tinted: 'bg-accent-soft text-tint hover:bg-accent-soft/70 active:bg-accent-soft/50',
        /** Neutral on a surface. */
        gray: 'bg-fill-tertiary text-label hover:bg-fill-secondary active:bg-fill',
        /** Text only. */
        plain: 'bg-transparent text-tint hover:bg-fill-quaternary active:bg-fill-tertiary',
        destructive:
          'glass-tinted text-on-accent [--glass-tint:var(--color-destructive)] hover:brightness-[1.08] active:brightness-[1.15]',
      },
      size: {
        sm: 'h-8 px-3.5 text-subhead [&_svg]:size-4',
        md: 'h-11 px-5 text-body [&_svg]:size-[18px]',
        lg: 'h-[52px] px-7 text-body [&_svg]:size-5',
      },
      iconOnly: { true: 'px-0' },
    },
    compoundVariants: [
      { size: 'sm', iconOnly: true, class: 'w-8' },
      { size: 'md', iconOnly: true, class: 'w-11 [&_svg]:size-5' },
      { size: 'lg', iconOnly: true, class: 'w-[52px] [&_svg]:size-[22px]' },
    ],
    defaultVariants: { variant: 'filled', size: 'md', iconOnly: false },
  },
)

export type ButtonVariants = VariantProps<typeof buttonVariants>
