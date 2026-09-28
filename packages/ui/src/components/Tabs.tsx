import { Content, List, Root, Trigger } from "@radix-ui/react-tabs";
import type { ComponentPropsWithRef } from "react";

import { cn } from "../lib/utils";

/**
 * Tabbed panels.
 *
 * Radix implements the ARIA tabs pattern: one tab stop for the whole list,
 * arrow keys to move between tabs, Home/End to jump, and the panel wired to
 * its tab with `aria-controls`/`aria-labelledby`.
 *
 *   <Tabs defaultValue="rewards">
 *     <TabsList>
 *       <TabsTrigger value="rewards">Rewards</TabsTrigger>
 *       <TabsTrigger value="fees">Fees</TabsTrigger>
 *     </TabsList>
 *     <TabsContent value="rewards">…</TabsContent>
 *   </Tabs>
 */
export const Tabs = Root;

export function TabsList({
  className,
  ...props
}: ComponentPropsWithRef<typeof List>) {
  return (
    <List
      className={cn(
        "inline-flex items-center gap-1 rounded-full bg-surface-sunken p-1",
        className,
      )}
      {...props}
    />
  );
}

export function TabsTrigger({
  className,
  ...props
}: ComponentPropsWithRef<typeof Trigger>) {
  return (
    <Trigger
      className={cn(
        "inline-flex h-11 items-center justify-center rounded-full px-4 text-sm font-semibold whitespace-nowrap",
        "text-content-muted transition-colors duration-fast ease-out-quart",
        "focus-ring",
        /* The active tab is marked by fill *and* by weight against the
         * surface, not by colour alone. */
        "data-[state=active]:bg-surface data-[state=active]:text-content-primary data-[state=active]:shadow-raised",
        "disabled:pointer-events-none disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}

export function TabsContent({
  className,
  ...props
}: ComponentPropsWithRef<typeof Content>) {
  return (
    <Content
      className={cn("mt-4 rounded-sm focus-ring", className)}
      {...props}
    />
  );
}
