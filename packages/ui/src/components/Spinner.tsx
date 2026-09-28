import { type VariantProps, cva } from "class-variance-authority";
import type { ComponentPropsWithRef } from "react";

import { cn } from "../lib/utils";

const spinnerVariants = cva("animate-spin shrink-0", {
  variants: {
    size: {
      sm: "size-4",
      md: "size-5",
      lg: "size-6",
    },
  },
  defaultVariants: { size: "md" },
});

export interface SpinnerProps
  extends Omit<ComponentPropsWithRef<"svg">, "children">,
    VariantProps<typeof spinnerVariants> {
  /**
   * Announced to assistive technology. Pass `null` when the spinner sits
   * inside something that already describes the wait: a Button in its
   * loading state, for example, where the button's own `aria-busy` and
   * label carry the meaning and a second announcement is just noise.
   */
  label?: string | null;
}

/**
 * An indeterminate progress indicator.
 *
 * The stroked arc inherits `currentColor` across surfaces.
 */
export function Spinner({
  className,
  size,
  label = "Loading",
  ...props
}: SpinnerProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      /* `status` (not `progressbar`) because there is no value to report;
       * with no label the element is hidden outright, since an unlabelled
       * live region is an announcement of nothing. */
      role={label === null ? "presentation" : "status"}
      aria-hidden={label === null ? true : undefined}
      aria-label={label ?? undefined}
      className={cn(spinnerVariants({ size }), className)}
      {...props}
    >
      <circle
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="2.5"
        className="opacity-25"
      />
      <path
        d="M22 12a10 10 0 0 1-10 10"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
    </svg>
  );
}
