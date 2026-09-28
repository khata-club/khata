import {
  Content,
  Group,
  Icon,
  Item,
  ItemIndicator,
  ItemText,
  Portal,
  Root,
  Label as SelectLabelPrimitive,
  Separator as SelectSeparatorPrimitive,
  Trigger,
  Value,
  Viewport,
} from "@radix-ui/react-select";
import { type ComponentPropsWithRef, createContext, use } from "react";
import { LuCheck, LuChevronDown } from "react-icons/lu";

import { cn } from "../lib/utils";
import { useFormField, useFormFieldLabelId } from "./FormField";

/* Share one accessible name between the trigger and portalled listbox. */
const SelectLabelContext = createContext<string | undefined>(undefined);

export interface SelectProps extends ComponentPropsWithRef<typeof Root> {
  /**
   * Accessible name for the control.
   *
   * Required unless the `Select` is inside a `FormField`, which supplies it
   * from the visible label. With neither, axe reports the trigger as a button
   * with no discernible text and the listbox as an unnamed input field.
   */
  label?: string;
}

/**
 * A single-choice dropdown.
 *
 * Use for rich options. Prefer a native `<select>` for long text-only lists.
 *
 *   <Select label="Card">
 *     <SelectTrigger><SelectValue placeholder="Pick a card" /></SelectTrigger>
 *     <SelectContent>
 *       <SelectItem value="hdfc">HDFC Millennia</SelectItem>
 *     </SelectContent>
 *   </Select>
 */
export function Select({ label, children, required, ...props }: SelectProps) {
  const field = useFormField();
  return (
    <SelectLabelContext value={label}>
      <Root required={required ?? Boolean(field["aria-required"])} {...props}>
        {children}
      </Root>
    </SelectLabelContext>
  );
}

export const SelectGroup = Group;
export const SelectValue = Value;

export type SelectTriggerProps = ComponentPropsWithRef<typeof Trigger>;

/**
 * The control that opens the listbox.
 *
 * Takes its accessible name from the enclosing `FormField`'s label, or from
 * `Select`'s `label` prop. An explicit `aria-label` here still wins.
 */
export function SelectTrigger({
  className,
  children,
  disabled,
  ...props
}: SelectTriggerProps) {
  const field = useFormField();
  const labelId = useFormFieldLabelId();
  const label = use(SelectLabelContext);

  return (
    <Trigger
      aria-labelledby={labelId}
      aria-label={labelId ? undefined : label}
      className={cn(
        "flex h-11 w-full items-center justify-between gap-2 rounded-md px-4",
        "border border-edge-control bg-surface text-base text-content-primary",
        "focus-ring transition-colors duration-fast ease-out-quart",
        "data-placeholder:text-content-muted",
        "aria-invalid:border-danger",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...field}
      disabled={disabled ?? field.disabled}
      {...props}
    >
      {children}
      <Icon asChild>
        <LuChevronDown
          aria-hidden="true"
          className="size-4 shrink-0 text-content-muted transition-transform duration-fast"
        />
      </Icon>
    </Trigger>
  );
}

export type SelectContentProps = ComponentPropsWithRef<typeof Content>;

export function SelectContent({
  className,
  children,
  position = "popper",
  ...props
}: SelectContentProps) {
  const labelId = useFormFieldLabelId();
  const label = use(SelectLabelContext);

  return (
    /* Portalling prevents ancestor overflow from clipping the listbox. */
    <Portal>
      <Content
        position={position}
        aria-labelledby={labelId}
        aria-label={labelId ? undefined : label}
        className={cn(
          "relative z-popover max-h-96 min-w-32 overflow-hidden rounded-md",
          "border border-edge bg-surface text-content-primary shadow-overlay",
          "animate-surface-in",
          className,
        )}
        {...props}
      >
        <Viewport
          className={cn(
            "p-1",
            /* Match the listbox to its trigger. */
            position === "popper" &&
              "w-full min-w-(--radix-select-trigger-width)",
          )}
        >
          {children}
        </Viewport>
      </Content>
    </Portal>
  );
}

export type SelectItemProps = ComponentPropsWithRef<typeof Item>;

export function SelectItem({ className, children, ...props }: SelectItemProps) {
  return (
    <Item
      className={cn(
        "relative flex min-h-11 w-full cursor-pointer items-center gap-2 rounded-sm pr-8 pl-3 text-sm",
        "outline-hidden select-none",
        /* `data-highlighted` covers both hover and keyboard navigation, so
         * the pointer and the arrow keys light up the same row. */
        "data-highlighted:bg-brand-subtle data-highlighted:text-content-brand",
        "data-disabled:pointer-events-none data-disabled:opacity-50",
        className,
      )}
      {...props}
    >
      <ItemText>{children}</ItemText>
      <span className="absolute right-3 flex size-4 items-center justify-center">
        <ItemIndicator>
          <LuCheck aria-hidden="true" className="size-4" />
        </ItemIndicator>
      </span>
    </Item>
  );
}

export function SelectLabel({
  className,
  ...props
}: ComponentPropsWithRef<typeof SelectLabelPrimitive>) {
  return (
    <SelectLabelPrimitive
      className={cn(
        "px-3 py-2 text-xs font-semibold tracking-eyebrow text-content-muted uppercase",
        className,
      )}
      {...props}
    />
  );
}

export function SelectSeparator({
  className,
  ...props
}: ComponentPropsWithRef<typeof SelectSeparatorPrimitive>) {
  return (
    <SelectSeparatorPrimitive
      className={cn("-mx-1 my-1 h-px bg-edge", className)}
      {...props}
    />
  );
}
