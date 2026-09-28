import type { ComponentPropsWithRef } from "react";

import { cn } from "../lib/utils";

export interface TableProps extends ComponentPropsWithRef<"table"> {
  /**
   * The table's accessible name. Required.
   *
   * A screen reader user navigating by table needs to know what this one
   * holds before deciding to enter it, and "table with 6 columns, 40 rows"
   * does not tell them. Pass `hideCaption` if the design has a visible
   * heading elsewhere: the caption still exists, it is just not painted.
   */
  caption: string;
  hideCaption?: boolean;
}

/**
 * A data table.
 *
 * Includes a keyboard-focusable horizontal scroller for narrow viewports.
 *
 *   <Table caption="Recent transactions">
 *     <TableHeader>
 *       <TableRow>
 *         <TableHead>Merchant</TableHead>
 *         <TableHead numeric>Amount</TableHead>
 *       </TableRow>
 *     </TableHeader>
 *     <TableBody>…</TableBody>
 *   </Table>
 */
export function Table({
  className,
  caption,
  hideCaption = false,
  children,
  ...props
}: TableProps) {
  return (
    /* A `section` with an accessible name, which carries the `region` role
     * implicitly: no explicit `role` attribute needed. */
    <section
      className="w-full overflow-x-auto focus-ring"
      // biome-ignore lint/a11y/noNoninteractiveTabindex: a scroll container only a mouse can pan is a WCAG 2.1.1 failure, and that is the default for any `overflow-x-auto` element. Making the scroller focusable is the documented fix, not an oversight.
      tabIndex={0}
      aria-label={caption}
    >
      <table
        className={cn("w-full border-collapse text-left text-sm", className)}
        {...props}
      >
        <caption
          className={cn(
            "pb-3 text-left text-sm text-content-muted",
            hideCaption && "sr-only",
          )}
        >
          {caption}
        </caption>
        {children}
      </table>
    </section>
  );
}

export function TableHeader({
  className,
  ...props
}: ComponentPropsWithRef<"thead">) {
  return (
    <thead
      className={cn("[&_tr]:border-b [&_tr]:border-edge", className)}
      {...props}
    />
  );
}

export function TableBody({
  className,
  ...props
}: ComponentPropsWithRef<"tbody">) {
  return (
    <tbody className={cn("[&_tr:last-child]:border-0", className)} {...props} />
  );
}

export function TableFooter({
  className,
  ...props
}: ComponentPropsWithRef<"tfoot">) {
  return (
    <tfoot
      className={cn(
        "border-t border-edge bg-surface-sunken font-semibold",
        className,
      )}
      {...props}
    />
  );
}

export function TableRow({ className, ...props }: ComponentPropsWithRef<"tr">) {
  return (
    <tr
      className={cn(
        "border-b border-edge-subtle transition-colors duration-fast",
        "hover:bg-surface-sunken data-[state=selected]:bg-brand-subtle",
        className,
      )}
      {...props}
    />
  );
}

export interface TableHeadProps extends ComponentPropsWithRef<"th"> {
  /** Right-align. For any column of amounts. */
  numeric?: boolean;
}

export function TableHead({
  className,
  numeric = false,
  scope = "col",
  ...props
}: TableHeadProps) {
  return (
    <th
      /* `scope` defaults to `col`, which is right for almost every header
       * and is what associates a cell with its column when read aloud.
       * Without it a screen reader announces bare values with no context. */
      scope={scope}
      className={cn(
        "px-4 py-3 text-xs font-semibold tracking-eyebrow text-content-muted uppercase",
        numeric && "text-right",
        className,
      )}
      {...props}
    />
  );
}

export interface TableCellProps extends ComponentPropsWithRef<"td"> {
  /** Right-align, matching a `numeric` head. */
  numeric?: boolean;
}

export function TableCell({
  className,
  numeric = false,
  ...props
}: TableCellProps) {
  return (
    <td
      className={cn(
        "px-4 py-3 text-content-secondary",
        /* Right-aligned so the minor units share an edge and a column of
         * amounts can be compared by eye instead of read. */
        numeric && "text-right text-content-primary",
        className,
      )}
      {...props}
    />
  );
}
