import { Indicator, Item, Root } from "@radix-ui/react-radio-group";
import type { ComponentPropsWithRef } from "react";

import { cn } from "../lib/utils";

export type RadioGroupProps = ComponentPropsWithRef<typeof Root>;

/**
 * A set of mutually exclusive options.
 *
 * Radix gives this roving tabstop behaviour: the group is one tab stop and
 * the arrow keys move between options, which is what the ARIA pattern
 * requires and what hand-rolled radio groups almost always get wrong.
 *
 * Inside a `FormField`, wrap it in a `fieldset`/`legend` if the group needs
 * its own heading: a `label` cannot name a group.
 */
export function RadioGroup({ className, ...props }: RadioGroupProps) {
  return <Root className={cn("grid gap-3", className)} {...props} />;
}

export type RadioGroupItemProps = ComponentPropsWithRef<typeof Item>;

export function RadioGroupItem({ className, ...props }: RadioGroupItemProps) {
  return (
    <Item
      className={cn(
        "relative inline-flex size-11 shrink-0 items-center justify-center rounded-full",
        "before:absolute before:size-5 before:rounded-full before:border before:border-edge-control before:bg-surface",
        "focus-ring transition-colors duration-fast ease-out-quart",
        "data-[state=checked]:before:border-brand",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    >
      <Indicator className="relative flex size-5 items-center justify-center">
        {/* A filled dot preserves the radio-control convention. */}
        <span className="block size-2 rounded-full bg-brand" />
      </Indicator>
    </Item>
  );
}
