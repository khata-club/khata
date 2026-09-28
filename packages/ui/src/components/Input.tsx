import { type VariantProps, cva } from "class-variance-authority";
import type { ComponentPropsWithRef, ReactNode } from "react";

import { cn } from "../lib/utils";
import { useFormField } from "./FormField";

const inputVariants = cva(
  [
    "w-full rounded-md bg-surface text-content-primary",
    /* `edge-control`, not `edge`: this border is the only thing announcing
     * that the element is interactive, so WCAG 1.4.11's 3:1 applies to it.
     * See the note in the token package's semantic.css. */
    "border border-edge-control",
    "transition-[border-color,box-shadow] duration-fast ease-out-quart",
    "focus-ring focus-visible:border-brand",
    "placeholder:text-content-muted",
    "disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-surface-sunken",
    "aria-invalid:border-danger aria-invalid:focus-visible:border-danger",
    /* Keep the file-picker button from inheriting the field's chrome. */
    "file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-content-brand",
  ],
  {
    variants: {
      inputSize: {
        /* Matched to Button so a field and its submit line up. */
        sm: "h-9 px-3 text-sm",
        default: "h-11 px-4 text-base",
        lg: "h-12 px-4 text-lg",
      },
    },
    defaultVariants: { inputSize: "default" },
  },
);

export interface InputProps
  extends Omit<ComponentPropsWithRef<"input">, "size">,
    VariantProps<typeof inputVariants> {
  /** Icon or symbol rendered inside the leading edge of the field. */
  leadingIcon?: ReactNode;
  /** Unit or action rendered inside the trailing edge: "INR", "%", a button. */
  trailingAddon?: ReactNode;
}

/**
 * A single-line text field.
 *
 * Inside a `FormField` it needs no props to be accessible: the id,
 * `aria-describedby`, `aria-invalid` and `aria-required` are taken from
 * context. Outside one, everything can still be passed explicitly.
 */
export function Input({
  className,
  type,
  inputSize,
  leadingIcon,
  trailingAddon,
  disabled,
  required,
  ...props
}: InputProps) {
  const field = useFormField();

  /* Explicit props win. A caller who passes `id` or `aria-invalid` is
   * overriding the field on purpose, and the spread order says so. */
  const input = (
    <input
      type={type}
      className={cn(
        inputVariants({ inputSize }),
        leadingIcon && "pl-10",
        trailingAddon && "pr-14",
        className,
      )}
      {...field}
      disabled={disabled ?? field.disabled}
      required={required ?? field["aria-required"]}
      {...props}
    />
  );

  if (!leadingIcon && !trailingAddon) return input;

  return (
    <div className="relative flex items-center">
      {leadingIcon ? (
        /* `pointer-events-none` so a click on the icon still lands on the
         * field and places the caret, which is what it looks like it does. */
        <span
          aria-hidden="true"
          className="pointer-events-none absolute left-4 flex text-content-muted"
        >
          {leadingIcon}
        </span>
      ) : null}

      {input}

      {trailingAddon ? (
        <span className="absolute right-4 flex items-center text-sm text-content-muted">
          {trailingAddon}
        </span>
      ) : null}
    </div>
  );
}

export { inputVariants };
