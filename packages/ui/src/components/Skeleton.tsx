import { type VariantProps, cva } from "class-variance-authority";
import type { ComponentPropsWithRef } from "react";

import { cn } from "../lib/utils";

const skeletonVariants = cva("animate-pulse bg-surface-sunken", {
  variants: {
    shape: {
      text: "h-4 rounded-sm",
      heading: "h-8 rounded-sm",
      block: "rounded-md",
      circle: "rounded-full",
    },
  },
  defaultVariants: { shape: "text" },
});

export interface SkeletonProps
  extends ComponentPropsWithRef<"div">,
    VariantProps<typeof skeletonVariants> {}

/**
 * A placeholder for content that is still loading.
 *
 * Hidden from assistive technology. A screen reader user gains nothing from
 * "image, image, image" while a table loads: announce the wait once, on the
 * region that is loading (`aria-busy`), not once per placeholder.
 *
 * `animate-pulse` is neutralised by the global `prefers-reduced-motion` rule
 * in the token package, so a page of these does not shimmer at someone who
 * has asked it not to.
 */
export function Skeleton({ className, shape, ...props }: SkeletonProps) {
  return (
    <div
      aria-hidden="true"
      className={cn(skeletonVariants({ shape }), className)}
      {...props}
    />
  );
}

export { skeletonVariants };
