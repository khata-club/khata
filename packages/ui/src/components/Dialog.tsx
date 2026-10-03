import {
  Close,
  Content,
  Description,
  Overlay,
  Portal,
  Root,
  Title,
  Trigger,
} from "@radix-ui/react-dialog";
import type { ComponentPropsWithRef } from "react";
import { LuX } from "react-icons/lu";

import { cn } from "../lib/utils";
import { VisuallyHidden } from "./VisuallyHidden";

/**
 * A modal dialog.
 *
 * Radix handles what makes a modal actually modal, and what is nearly always
 * missing from a hand-rolled one: focus moves into the dialog on open and
 * returns to the trigger on close, Tab is trapped inside, Escape dismisses,
 * the rest of the page is hidden from screen readers with `aria-hidden`, and
 * background scroll is locked without the layout shifting.
 *
 *   <Dialog>
 *     <DialogTrigger asChild><Button>Report a charge</Button></DialogTrigger>
 *     <DialogContent>
 *       <DialogHeader>
 *         <DialogTitle>Report a charge</DialogTitle>
 *         <DialogDescription>We verify every report.</DialogDescription>
 *       </DialogHeader>
 *       …
 *     </DialogContent>
 *   </Dialog>
 */
export const Dialog = Root;
export const DialogTrigger = Trigger;
export const DialogClose = Close;

export interface DialogContentProps
  extends ComponentPropsWithRef<typeof Content> {
  /** Hide the built-in close button when the content provides its own. */
  hideCloseButton?: boolean;
  /** Accessible name for the close button. */
  closeLabel?: string;
}

export function DialogContent({
  className,
  children,
  hideCloseButton = false,
  closeLabel = "Close",
  ...props
}: DialogContentProps) {
  return (
    <Portal>
      <Overlay className="fixed inset-0 z-overlay bg-surface-overlay animate-fade-in" />
      <Content
        className={cn(
          /* Insets keep long content reachable on short viewports. */
          "fixed inset-4 z-modal m-auto h-fit w-auto max-w-lg max-h-(--dialog-max-height) overflow-y-auto",
          "rounded-card border border-edge bg-surface p-6 shadow-overlay",
          "animate-surface-in",
          className,
        )}
        {...props}
      >
        {children}

        {hideCloseButton ? null : (
          <Close
            className={cn(
              "absolute top-4 right-4 inline-flex size-11 items-center justify-center rounded-full",
              "text-content-muted transition-colors duration-fast ease-out-quart",
              "focus-ring hover:bg-surface-sunken hover:text-content-primary",
            )}
          >
            <LuX aria-hidden="true" className="size-4" />
            {/* An icon-only control still needs a name. */}
            <VisuallyHidden>{closeLabel}</VisuallyHidden>
          </Close>
        )}
      </Content>
    </Portal>
  );
}

export function DialogHeader({
  className,
  ...props
}: ComponentPropsWithRef<"div">) {
  return (
    <div className={cn("flex flex-col gap-1 pr-8", className)} {...props} />
  );
}

export function DialogFooter({
  className,
  ...props
}: ComponentPropsWithRef<"div">) {
  return (
    <div
      className={cn(
        "mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end",
        className,
      )}
      {...props}
    />
  );
}

/**
 * The dialog's accessible name. Required: Radix warns in development when
 * it is missing, because a dialog with no name is announced as just
 * "dialog". Use `VisuallyHidden` if the design has no visible title.
 */
export function DialogTitle({
  className,
  ...props
}: ComponentPropsWithRef<typeof Title>) {
  return (
    <Title
      className={cn(
        "font-display text-xl font-medium tracking-heading text-content-primary",
        className,
      )}
      {...props}
    />
  );
}

export function DialogDescription({
  className,
  ...props
}: ComponentPropsWithRef<typeof Description>) {
  return (
    <Description
      className={cn("text-sm text-content-muted", className)}
      {...props}
    />
  );
}
