import { Fallback, Image, Root } from "@radix-ui/react-avatar";
import { type VariantProps, cva } from "class-variance-authority";
import type { ComponentPropsWithRef } from "react";

import { cn } from "../lib/utils";

const avatarVariants = cva(
  "relative flex shrink-0 overflow-hidden rounded-full bg-surface-sunken",
  {
    variants: {
      size: {
        sm: "size-8 text-xs",
        default: "size-10 text-sm",
        lg: "size-12 text-base",
      },
    },
    defaultVariants: { size: "default" },
  },
);

export interface AvatarProps
  extends ComponentPropsWithRef<typeof Root>,
    VariantProps<typeof avatarVariants> {}

/**
 * A user or issuer image with a text fallback.
 *
 * Radix handles the part that is tedious by hand: the fallback renders only
 * after the image has actually failed or is still loading, so there is no
 * flash of initials on a fast connection and no empty circle on a slow one.
 */
export function Avatar({ className, size, ...props }: AvatarProps) {
  return (
    <Root className={cn(avatarVariants({ size }), className)} {...props} />
  );
}

export function AvatarImage({
  className,
  alt,
  ...props
}: ComponentPropsWithRef<typeof Image>) {
  return (
    <Image
      /* The fallback carries the accessible name. */
      alt={alt ?? ""}
      className={cn("aspect-square size-full object-cover", className)}
      {...props}
    />
  );
}

export function AvatarFallback({
  className,
  ...props
}: ComponentPropsWithRef<typeof Fallback>) {
  return (
    <Fallback
      className={cn(
        "flex size-full items-center justify-center bg-brand-subtle font-semibold text-content-brand",
        className,
      )}
      {...props}
    />
  );
}

export { avatarVariants };
