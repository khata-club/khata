import { Root, Thumb } from "@radix-ui/react-switch";
import type { ComponentPropsWithRef } from "react";

import { cn } from "../lib/utils";
import { useFormField } from "./FormField";

export type SwitchProps = ComponentPropsWithRef<typeof Root>;

/**
 * An on/off toggle that takes effect immediately.
 *
 * Use a `Checkbox` when a change waits for form submission.
 */
export function Switch({ className, disabled, ...props }: SwitchProps) {
  const field = useFormField();

  return (
    <Root
      className={cn(
        "peer relative inline-flex size-11 shrink-0 items-center rounded-full",
        "before:absolute before:h-6 before:w-11 before:rounded-full before:border before:border-transparent",
        "focus-ring transition-colors duration-fast ease-out-quart",
        /* Unchecked reads as a control, not as a disabled one: `edge-control`
         * clears 3:1 against the surface where a hairline would not. */
        "before:bg-surface-sunken before:ring-1 before:ring-edge-control before:ring-inset",
        "data-[state=checked]:before:bg-brand data-[state=checked]:before:ring-brand",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...field}
      disabled={disabled ?? field.disabled}
      {...props}
    >
      <Thumb
        className={cn(
          "pointer-events-none relative ml-1 block size-4 rounded-full bg-surface shadow-raised",
          "transition-transform duration-fast ease-out-quart",
          "translate-x-0 data-[state=checked]:translate-x-5",
        )}
      />
    </Root>
  );
}
