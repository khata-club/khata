import type { ComponentPropsWithRef } from "react";

import { cn } from "../lib/utils";

export interface LabelProps extends ComponentPropsWithRef<"label"> {
  /** Renders the required marker and its screen-reader text. */
  required?: boolean;
}

/**
 * A form control's visible name.
 *
 * Prefer `FormField`, which creates the ids and wires this up. Reach for
 * `Label` directly only when building a layout `FormField` does not cover.
 */
export function Label({
  className,
  required = false,
  children,
  ...props
}: LabelProps) {
  return (
    /* biome-ignore lint/a11y/noLabelWithoutControl: this is the generic Label
     * primitive: the association is made by the caller's `htmlFor`, or by
     * FormField, which passes it. The rule cannot see past the component
     * boundary, and FormField's own test asserts the association holds. */
    <label
      className={cn(
        "inline-flex items-center gap-1 text-sm font-semibold text-content-primary",
        className,
      )}
      {...props}
    >
      {children}
      {required ? (
        <>
          <span aria-hidden="true" className="text-danger-fg">
            *
          </span>
          {/* The asterisk is a convention, not a word. Screen readers either
           * say "star" or skip it, so the meaning is spelled out. The
           * control itself also carries `required`/`aria-required`; this is
           * the visible half. */}
          <span className="sr-only">(required)</span>
        </>
      ) : null}
    </label>
  );
}
