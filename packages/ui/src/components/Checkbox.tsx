import { Indicator, Root } from "@radix-ui/react-checkbox";
import type { ComponentPropsWithRef } from "react";
import { LuCheck, LuMinus } from "react-icons/lu";

import { cn } from "../lib/utils";
import { useFormField } from "./FormField";

export type CheckboxProps = ComponentPropsWithRef<typeof Root>;

/**
 * A checkbox, including the indeterminate state.
 *
 * Inside a `FormField` the id and ARIA wiring come from context.
 */
export function Checkbox({
  className,
  disabled,
  required,
  ...props
}: CheckboxProps) {
  const field = useFormField(props);

  return (
    <Root
      className={cn(
        "peer relative inline-flex size-11 shrink-0 items-center justify-center rounded-md",
        "before:absolute before:size-5 before:rounded-xs before:border before:border-edge-control before:bg-surface",
        "focus-ring transition-colors duration-fast ease-out-quart",
        "data-[state=checked]:before:border-brand data-[state=checked]:before:bg-brand data-[state=checked]:text-on-brand",
        "data-[state=indeterminate]:before:border-brand data-[state=indeterminate]:before:bg-brand data-[state=indeterminate]:text-on-brand",
        "aria-invalid:before:border-danger",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
      {...field}
      disabled={disabled ?? field.disabled}
      required={
        required ??
        (field["aria-required"] === true || field["aria-required"] === "true")
      }
    >
      {/* Radix state supports controlled and uncontrolled indeterminate use. */}
      <Indicator className="group relative flex items-center justify-center text-current">
        <LuCheck
          aria-hidden="true"
          className="size-4 group-data-[state=indeterminate]:hidden"
        />
        <LuMinus
          aria-hidden="true"
          className="hidden size-4 group-data-[state=indeterminate]:block"
        />
      </Indicator>
    </Root>
  );
}
