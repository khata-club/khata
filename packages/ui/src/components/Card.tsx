import { type VariantProps, cva } from "class-variance-authority";
import type { ComponentPropsWithRef } from "react";

import { cn } from "../lib/utils";

const cardVariants = cva("relative overflow-hidden", {
  variants: {
    variant: {
      glass: "glass",
      solid: "bg-surface border border-edge shadow-raised",
      /* Ledger rows stay flat when repeated in a list. */
      transaction: "bg-surface-sunken shadow-hairline",
    },
    radius: {
      md: "rounded-md",
      card: "rounded-card",
    },
    padding: {
      none: "",
      sm: "p-4",
      default: "p-6",
      lg: "p-8",
    },
  },
  defaultVariants: { variant: "glass", radius: "card", padding: "none" },
});

export interface CardProps
  extends ComponentPropsWithRef<"div">,
    VariantProps<typeof cardVariants> {}

/**
 * A surface that groups related content.
 *
 * Its parts keep spacing and type consistent:
 *
 *   <Card padding="default">
 *     <CardHeader>
 *       <CardTitle>HDFC Millennia</CardTitle>
 *       <CardDescription>Verified 2 days ago</CardDescription>
 *     </CardHeader>
 *     <CardContent>…</CardContent>
 *     <CardFooter>…</CardFooter>
 *   </Card>
 */
export function Card({
  className,
  variant,
  radius,
  padding,
  ...props
}: CardProps) {
  return (
    <div
      className={cn(cardVariants({ variant, radius, padding }), className)}
      {...props}
    />
  );
}

export function CardHeader({
  className,
  ...props
}: ComponentPropsWithRef<"div">) {
  return <div className={cn("flex flex-col gap-1", className)} {...props} />;
}

type CardTitleElement = "h1" | "h2" | "h3" | "h4" | "h5" | "h6" | "div";

export type CardTitleProps<T extends CardTitleElement = "h3"> = {
  as?: T;
} & Omit<ComponentPropsWithRef<T>, "as">;

export function CardTitle<T extends CardTitleElement = "h3">({
  className,
  as,
  ...props
}: CardTitleProps<T>) {
  const heading = as ?? "h3";
  const Comp = heading as CardTitleElement;
  return (
    <Comp
      className={cn(
        "font-display text-xl font-medium tracking-heading text-content-primary",
        className,
      )}
      {...props}
    />
  );
}

export function CardDescription({
  className,
  ...props
}: ComponentPropsWithRef<"p">) {
  return (
    <p className={cn("text-sm text-content-muted", className)} {...props} />
  );
}

export function CardContent({
  className,
  ...props
}: ComponentPropsWithRef<"div">) {
  return <div className={cn("text-content-secondary", className)} {...props} />;
}

export function CardFooter({
  className,
  ...props
}: ComponentPropsWithRef<"div">) {
  return (
    <div className={cn("flex items-center gap-3", className)} {...props} />
  );
}

export { cardVariants };
