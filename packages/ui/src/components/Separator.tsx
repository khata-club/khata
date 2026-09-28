import { Root } from "@radix-ui/react-separator";
import type { ComponentPropsWithRef } from "react";

import { cn } from "../lib/utils";

export type SeparatorProps = ComponentPropsWithRef<typeof Root>;

/**
 * A dividing rule.
 *
 * Defaults to `decorative`, which renders `role="none"`: correct for a line
 * that repeats a grouping the layout already makes obvious, and which would
 * otherwise be one more "separator" announced on the way down the page. Pass
 * `decorative={false}` when the rule is the *only* thing marking a boundary.
 */
export function Separator({
  className,
  orientation = "horizontal",
  decorative = true,
  ...props
}: SeparatorProps) {
  return (
    <Root
      orientation={orientation}
      decorative={decorative}
      className={cn(
        "shrink-0 bg-edge",
        orientation === "horizontal" ? "h-px w-full" : "h-full w-px",
        className,
      )}
      {...props}
    />
  );
}
