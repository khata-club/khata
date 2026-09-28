import { Slot } from "@radix-ui/react-slot";
import { type VariantProps, cva } from "class-variance-authority";
import type { ComponentPropsWithRef, ReactNode } from "react";

import { cn } from "../lib/utils";
import { Spinner } from "./Spinner";

const buttonVariants = cva(
  [
    "inline-flex items-center justify-center gap-2 whitespace-nowrap",
    "rounded-full font-semibold",
    "transition-[background-color,border-color,color,box-shadow,transform] duration-base ease-out-quart",
    "focus-ring",
    /* `disabled:` covers the real attribute; `aria-disabled` covers the case
     * where the control must stay focusable so a screen reader can find it
     * and hear why it is unavailable. */
    "disabled:pointer-events-none disabled:opacity-50",
    "aria-disabled:pointer-events-none aria-disabled:opacity-50",
    /* No `enabled:` guard needed on the hover states below: both disabled
     * rules set `pointer-events-none`, so `:hover` cannot match. Neutralised
     * under `prefers-reduced-motion` by the global rule in the token
     * package, so the lift needs no per-component guard either. */
    "hover:-translate-y-px active:translate-y-0",
  ],
  {
    variants: {
      variant: {
        primary:
          "bg-brand text-on-brand shadow-raised hover:bg-brand-hover active:bg-brand-active",
        secondary:
          "glass text-content-primary hover:border-brand hover:text-content-brand",
        outline:
          "border-2 border-brand text-content-brand bg-transparent hover:bg-brand hover:text-on-brand",
        ghost:
          "text-content-secondary bg-transparent hover:bg-surface-sunken hover:text-content-primary",
        destructive:
          "bg-danger text-on-danger shadow-raised hover:bg-danger-fg active:bg-danger-fg",
      },
      size: {
        /* 44px is the WCAG 2.5.5 target size, and the reason `default` is not
         * the 40px that would look tidier next to a 40px input. */
        sm: "h-9 px-4 text-sm",
        default: "h-11 px-5 text-base",
        lg: "h-12 px-6 text-lg",
        icon: "size-11",
        "icon-sm": "size-9",
      },
    },
    defaultVariants: { variant: "primary", size: "default" },
  },
);

type ButtonBaseProps = ComponentPropsWithRef<"button"> &
  VariantProps<typeof buttonVariants> & {
    leftIcon?: ReactNode;
    rightIcon?: ReactNode;
  };

type NativeButtonProps = ButtonBaseProps & {
  asChild?: false;
  loading?: boolean;
  loadingLabel?: string;
};

type ChildButtonProps = Omit<
  ButtonBaseProps,
  "disabled" | "loading" | "loadingLabel" | "type"
> & {
  asChild: true;
  disabled?: never;
  loading?: never;
  loadingLabel?: never;
  type?: never;
};

export type ButtonProps = NativeButtonProps | ChildButtonProps;

/** Primary action control. Defaults to `type="button"`. */
export function Button({
  className,
  variant,
  size,
  asChild = false,
  loading = false,
  loadingLabel,
  leftIcon,
  rightIcon,
  disabled,
  children,
  type,
  ...props
}: ButtonProps) {
  const Comp = asChild ? Slot : "button";
  const iconOnly = size === "icon" || size === "icon-sm";

  /* Slot forwards to a single child, so the icon/spinner composition below
   * cannot apply: `asChild` hands styling to the consumer's element and
   * leaves its content alone. */
  const content = asChild ? (
    children
  ) : (
    <>
      {loading ? (
        <Spinner
          size={size === "lg" ? "lg" : "sm"}
          label={null}
          data-slot="spinner"
        />
      ) : (
        leftIcon
      )}
      {children}
      {!loading && rightIcon}
      {/* `<output>` is an implicit live region, so the wait is announced
       * without a `role="status"` that some mobile screen readers ignore. */}
      {loading && loadingLabel ? (
        <output className="sr-only">{loadingLabel}</output>
      ) : null}
    </>
  );

  return (
    <Comp
      type={asChild ? undefined : (type ?? "button")}
      disabled={asChild ? undefined : (disabled ?? loading)}
      aria-busy={loading || undefined}
      data-loading={loading || undefined}
      className={cn(
        buttonVariants({ variant, size }),
        /* An icon-only button has no visible text, so it needs an
         * `aria-label` from the caller. Nothing can enforce that at runtime
         * without guessing, so Storybook's a11y run is what catches it. */
        iconOnly && "px-0",
        className,
      )}
      {...props}
    >
      {content}
    </Comp>
  );
}

export { buttonVariants };
