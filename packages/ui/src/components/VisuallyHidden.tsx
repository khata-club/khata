import { Slot } from "@radix-ui/react-slot";
import type { ComponentPropsWithRef } from "react";

import { cn } from "../lib/utils";

export interface VisuallyHiddenProps extends ComponentPropsWithRef<"span"> {
  /** Render as the child element instead of a `span`. */
  asChild?: boolean;
}

/** Content visually hidden while retained in the accessibility tree. */
export function VisuallyHidden({
  className,
  asChild = false,
  ...props
}: VisuallyHiddenProps) {
  const Comp = asChild ? Slot : "span";
  return <Comp className={cn("sr-only", className)} {...props} />;
}
