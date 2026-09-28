import { type VariantProps, cva } from "class-variance-authority";
import {
  type ComponentPropsWithRef,
  type ElementType,
  createElement,
} from "react";

import { cn } from "../lib/utils";

const typographyVariants = cva("m-0", {
  variants: {
    variant: {
      displayXl:
        "font-display font-medium text-display-xl tracking-display text-content-primary",
      displayLg:
        "font-display font-medium text-display-lg tracking-display text-content-primary",
      displayMd:
        "font-display font-medium text-display-md tracking-display text-content-primary",
      h1: "font-display font-medium text-4xl tracking-heading text-content-primary",
      h2: "font-display font-medium text-3xl tracking-heading text-content-primary",
      h3: "font-display font-medium text-2xl tracking-heading text-content-primary",
      h4: "font-display font-medium text-xl tracking-heading text-content-primary",
      h5: "font-display font-semibold text-lg text-content-primary",
      h6: "font-display font-semibold text-base text-content-primary",
      eyebrow:
        "inline-flex items-center gap-2 text-xs font-semibold tracking-eyebrow uppercase text-content-brand",
      lead: "text-lg text-content-secondary",
      body: "text-base text-content-secondary",
      small: "text-sm text-content-secondary",
      caption: "text-xs text-content-muted",
      label: "text-sm font-semibold text-content-primary",
      legal: "text-2xs text-content-muted",
    },
  },
  defaultVariants: { variant: "body" },
});

type Variant = NonNullable<VariantProps<typeof typographyVariants>["variant"]>;

type TypographyElement =
  | "div"
  | "h1"
  | "h2"
  | "h3"
  | "h4"
  | "h5"
  | "h6"
  | "label"
  | "p"
  | "span";

/**
 * The element each variant renders by default.
 *
 * Presentation and semantics are separated on purpose: `displayXl` is a
 * size, not a rank. A page's second section might want display type at `h2`,
 * and a card title might want `h3` styling under an `h2`. The defaults below
 * are the common case, and `as` overrides them:
 *
 *   <Typography variant="displayLg" as="h2">…</Typography>
 *
 * Getting this wrong produces a heading outline that reads as nonsense to
 * anyone navigating by headings, which is invisible to everyone else.
 */
const defaultElement = {
  displayXl: "h1",
  displayLg: "h2",
  displayMd: "h2",
  h1: "h1",
  h2: "h2",
  h3: "h3",
  h4: "h4",
  h5: "h5",
  h6: "h6",
  eyebrow: "span",
  lead: "p",
  body: "p",
  small: "p",
  caption: "p",
  label: "span",
  legal: "p",
} as const satisfies Record<Variant, TypographyElement>;

export type TypographyProps<T extends TypographyElement = "p"> = {
  as?: T;
} & VariantProps<typeof typographyVariants> &
  Omit<ComponentPropsWithRef<T>, "as">;

/** Typography variants with element-specific props and refs. */
export function Typography<T extends TypographyElement = "p">({
  className,
  variant,
  as,
  ...props
}: TypographyProps<T>) {
  const Comp: ElementType = as ?? defaultElement[variant ?? "body"];
  return createElement(Comp, {
    ...props,
    className: cn(typographyVariants({ variant }), className),
  });
}

export { typographyVariants };
