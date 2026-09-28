import { type VariantProps, cva } from "class-variance-authority";
import type { ComponentPropsWithRef, ReactNode } from "react";

import { cn } from "../lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1 whitespace-nowrap rounded-full px-3 py-1 text-xs font-semibold",
  {
    variants: {
      variant: {
        neutral: "border border-edge bg-transparent text-content-secondary",
        brand: "border border-edge bg-brand-subtle text-content-brand",
        success: "bg-success-bg text-success-fg",
        warning: "bg-warning-bg text-warning-fg",
        danger: "bg-danger-bg text-danger-fg",
        info: "bg-info-bg text-info-fg",
      },
    },
    defaultVariants: { variant: "neutral" },
  },
);

export interface BadgeProps
  extends ComponentPropsWithRef<"span">,
    VariantProps<typeof badgeVariants> {
  /**
   * Icon or glyph shown before the label.
   *
   * Status must never be carried by colour alone (WCAG 1.4.1). The label
   * already does that job here; an icon reinforces it.
   */
  icon?: ReactNode;
}

/**
 * A short, non-interactive status marker.
 *
 * Renders inline. Use `BadgeButton` for interactive chips.
 */
export function Badge({
  className,
  variant,
  icon,
  children,
  ...props
}: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ variant }), className)} {...props}>
      {icon ? (
        <span aria-hidden="true" className="flex shrink-0">
          {icon}
        </span>
      ) : null}
      {children}
    </span>
  );
}

export interface BadgeButtonProps
  extends ComponentPropsWithRef<"button">,
    VariantProps<typeof badgeVariants> {
  icon?: ReactNode;
}

/** Interactive badge for filter chips and removable tags. */
export function BadgeButton({
  className,
  variant,
  icon,
  type,
  children,
  ...props
}: BadgeButtonProps) {
  return (
    <button
      type={type ?? "button"}
      className={cn(
        badgeVariants({ variant }),
        "min-h-11 min-w-11 focus-ring transition-colors duration-fast ease-out-quart",
        "hover:border-brand hover:text-content-brand",
        "aria-pressed:bg-brand aria-pressed:text-on-brand aria-pressed:border-transparent",
        "disabled:pointer-events-none disabled:opacity-50",
        className,
      )}
      {...props}
    >
      {icon ? (
        <span aria-hidden="true" className="flex shrink-0">
          {icon}
        </span>
      ) : null}
      {children}
    </button>
  );
}

export { badgeVariants };
