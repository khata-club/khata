import {
  Arrow,
  Content,
  Portal,
  Provider,
  Root,
  Trigger,
} from "@radix-ui/react-tooltip";
import type { ComponentPropsWithRef } from "react";

import { cn } from "../lib/utils";

/**
 * A short hint attached to a control.
 *
 * Tooltips are supplementary by definition: they do not appear on touch, and
 * they cannot be reached by a screen reader user who is not focusing the
 * trigger. Anything a user *needs* in order to complete the task belongs in
 * the page: a `FormField` description, or visible copy.
 *
 * `TooltipProvider` must wrap the app once. It is what lets a second tooltip
 * open instantly after a first, instead of re-serving the open delay.
 */
export const TooltipProvider = Provider;
export const Tooltip = Root;
export const TooltipTrigger = Trigger;

export interface TooltipContentProps
  extends ComponentPropsWithRef<typeof Content> {
  /** Draw the arrow pointing at the trigger. */
  withArrow?: boolean;
}

export function TooltipContent({
  className,
  sideOffset = 8,
  withArrow = true,
  children,
  ...props
}: TooltipContentProps) {
  return (
    <Portal>
      <Content
        sideOffset={sideOffset}
        className={cn(
          "z-popover max-w-64 rounded-md px-3 py-2 text-sm",
          /* The inverse surface distinguishes overlays from page content. */
          "bg-surface-inverse text-content-inverse shadow-overlay",
          "animate-surface-in",
          className,
        )}
        {...props}
      >
        {children}
        {withArrow ? <Arrow className="fill-surface-inverse" /> : null}
      </Content>
    </Portal>
  );
}
