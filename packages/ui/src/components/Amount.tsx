import { type VariantProps, cva } from "class-variance-authority";
import type { ComponentPropsWithRef } from "react";

import { type FormatAmountOptions, formatAmount } from "../lib/currency";
import { cn } from "../lib/utils";

const amountVariants = cva("", {
  variants: {
    size: {
      sm: "text-sm",
      default: "text-base",
      lg: "text-xl font-semibold",
      display: "text-3xl font-semibold",
    },
    tone: {
      neutral: "text-amount-neutral",
      positive: "text-amount-positive",
      negative: "text-amount-negative",
      muted: "text-content-muted",
    },
  },
  defaultVariants: { size: "default", tone: "neutral" },
});

export interface AmountProps
  extends Omit<ComponentPropsWithRef<"data">, "value">,
    Omit<VariantProps<typeof amountVariants>, "tone">,
    FormatAmountOptions {
  /** `auto` maps positive, negative, and zero values to semantic tones. */
  tone?: "auto" | "neutral" | "positive" | "negative" | "muted";
}

/**
 * A currency amount.
 *
 * Renders `<data>`, so the exact value stays in the markup even when the
 * display is compacted to `1.2L`.
 *
 *   <Amount value={-125000} signed tone="auto" />   →  −₹1,250.00
 *   <Amount value={12000000} compact />             →  ₹1.2L
 */
export function Amount({
  value,
  currency,
  locale,
  compact,
  hideFraction,
  signed,
  size,
  tone = "neutral",
  className,
  ...props
}: AmountProps) {
  const { formatted, sign, exactMajor, negative } = formatAmount({
    value,
    currency,
    locale,
    compact,
    hideFraction,
    signed,
  });

  let resolvedTone: Exclude<AmountProps["tone"], "auto">;
  if (tone === "auto") {
    resolvedTone = negative ? "negative" : value > 0 ? "positive" : "neutral";
  } else resolvedTone = tone;

  return (
    <data
      /* Preserve the uncompacted value for copy and machine use. */
      value={exactMajor}
      data-minor-units={String(value)}
      data-currency={(currency ?? "INR").toUpperCase()}
      className={cn(amountVariants({ size, tone: resolvedTone }), className)}
      {...props}
    >
      {sign ? (
        <>
          <span aria-hidden="true">{sign}</span>
          {/* Some screen readers skip a bare sign glyph. */}
          <span className="sr-only">{negative ? "minus " : "plus "}</span>
        </>
      ) : null}
      {formatted}
    </data>
  );
}

export { amountVariants };
