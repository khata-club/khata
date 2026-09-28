import {
  Action,
  Close,
  Description,
  Provider,
  Root,
  Title,
  Viewport,
} from "@radix-ui/react-toast";
import { type VariantProps, cva } from "class-variance-authority";
import type { ComponentPropsWithRef } from "react";
import {
  LuCircleAlert,
  LuCircleCheck,
  LuInfo,
  LuTriangleAlert,
  LuX,
} from "react-icons/lu";

import { cn } from "../lib/utils";
import { VisuallyHidden } from "./VisuallyHidden";

/**
 * A transient notification.
 *
 * Radix gives this the behaviour that is hard to get right: the viewport is
 * an ARIA live region so a toast is announced without moving focus, hovering
 * or focusing pauses the dismiss timer, swipe dismisses on touch, and F6
 * jumps to the toast list: the escape hatch for a keyboard user who needs
 * to reach an action before it disappears.
 *
 * Never put something the user must act on in a toast alone. It will be
 * gone in five seconds, and anyone who was reading elsewhere will miss it.
 */
export const ToastProvider = Provider;
export const ToastAction = Action;

const toastVariants = cva(
  [
    "group pointer-events-auto relative flex w-full items-start gap-3",
    "rounded-md border p-4 shadow-overlay",
    "animate-slide-in-right",
  ],
  {
    variants: {
      variant: {
        neutral: "border-edge bg-surface text-content-primary",
        success: "border-success-edge bg-success-bg text-success-fg",
        warning: "border-warning-edge bg-warning-bg text-warning-fg",
        danger: "border-danger-edge bg-danger-bg text-danger-fg",
        info: "border-info-edge bg-info-bg text-info-fg",
      },
    },
    defaultVariants: { variant: "neutral" },
  },
);

/** Colour never carries the meaning on its own: WCAG 1.4.1. */
const variantIcon = {
  neutral: LuInfo,
  success: LuCircleCheck,
  warning: LuTriangleAlert,
  danger: LuCircleAlert,
  info: LuInfo,
} as const;

export interface ToastProps
  extends ComponentPropsWithRef<typeof Root>,
    VariantProps<typeof toastVariants> {
  closeLabel?: string;
}

export function Toast({
  className,
  variant = "neutral",
  children,
  closeLabel = "Dismiss",
  ...props
}: ToastProps) {
  const Icon = variantIcon[variant ?? "neutral"];

  return (
    <Root className={cn(toastVariants({ variant }), className)} {...props}>
      <Icon aria-hidden="true" className="mt-1 size-4 shrink-0" />
      <div className="flex min-w-0 flex-1 flex-col gap-1">{children}</div>
      <Close
        className={cn(
          "inline-flex size-11 shrink-0 items-center justify-center rounded-full",
          "opacity-70 transition-opacity duration-fast hover:opacity-100",
          "focus-ring",
        )}
      >
        <LuX aria-hidden="true" className="size-4" />
        <VisuallyHidden>{closeLabel}</VisuallyHidden>
      </Close>
    </Root>
  );
}

export function ToastTitle({
  className,
  ...props
}: ComponentPropsWithRef<typeof Title>) {
  return (
    <Title className={cn("text-sm font-semibold", className)} {...props} />
  );
}

export function ToastDescription({
  className,
  ...props
}: ComponentPropsWithRef<typeof Description>) {
  return (
    <Description className={cn("text-sm opacity-90", className)} {...props} />
  );
}

export function ToastViewport({
  className,
  ...props
}: ComponentPropsWithRef<typeof Viewport>) {
  return (
    <Viewport
      className={cn(
        "fixed right-0 bottom-0 z-toast flex max-h-dvh w-full flex-col-reverse gap-2 p-4",
        /* Bottom-right on desktop, full-width along the bottom on mobile,
         * where a floating card in the corner competes with the thumb. */
        "sm:top-auto sm:right-0 sm:bottom-0 sm:max-w-96",
        /* `pointer-events-none` on the viewport and `auto` on each toast, so
         * the empty area around them does not swallow clicks on the page
         * underneath. */
        "pointer-events-none",
        className,
      )}
      {...props}
    />
  );
}

export { toastVariants };
