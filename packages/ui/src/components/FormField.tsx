import {
  type ComponentPropsWithRef,
  type ReactNode,
  createContext,
  use,
  useId,
  useMemo,
} from "react";

import { cn } from "../lib/utils";
import { Label } from "./Label";

type FormFieldContextValue = {
  controlId: string;
  labelId: string;
  descriptionId: string | undefined;
  errorId: string | undefined;
  invalid: boolean;
  required: boolean;
  disabled: boolean;
};

const FormFieldContext = createContext<FormFieldContextValue | null>(null);

/** Accessibility props for controls inside a `FormField`. */
export function useFormField(): {
  id: string | undefined;
  "aria-describedby": string | undefined;
  "aria-invalid": true | undefined;
  "aria-required": true | undefined;
  disabled: boolean | undefined;
} {
  const ctx = use(FormFieldContext);
  if (!ctx) {
    return {
      id: undefined,
      "aria-describedby": undefined,
      "aria-invalid": undefined,
      "aria-required": undefined,
      disabled: undefined,
    };
  }

  /* Preserve help text when an error appears. */
  const describedBy =
    [ctx.errorId, ctx.descriptionId].filter(Boolean).join(" ") || undefined;

  return {
    id: ctx.controlId,
    "aria-describedby": describedBy,
    "aria-invalid": ctx.invalid || undefined,
    "aria-required": ctx.required || undefined,
    disabled: ctx.disabled || undefined,
  };
}

/** Label id for composite controls with a separate popup. */
export function useFormFieldLabelId(): string | undefined {
  return use(FormFieldContext)?.labelId;
}

export interface FormFieldProps
  extends Omit<ComponentPropsWithRef<"div">, "children"> {
  label: ReactNode;
  /** The control. Receives the generated id and ARIA wiring automatically. */
  children: ReactNode;
  /** Format hint or help text, shown below the control. */
  description?: ReactNode;
  /** When set, the field renders as invalid and this is announced. */
  error?: ReactNode;
  required?: boolean;
  disabled?: boolean;
  /** Hide the label visually but keep it for assistive technology. */
  hideLabel?: boolean;
}

/** Label, control, description, and error as one accessible unit. */
export function FormField({
  label,
  children,
  description,
  error,
  required = false,
  disabled = false,
  hideLabel = false,
  className,
  ...props
}: FormFieldProps) {
  const base = useId();
  const invalid = Boolean(error);
  const described = Boolean(description);

  /* React nodes are often recreated when their presence is unchanged. */
  const value = useMemo<FormFieldContextValue>(
    () => ({
      controlId: `${base}-control`,
      labelId: `${base}-label`,
      descriptionId: described ? `${base}-description` : undefined,
      errorId: invalid ? `${base}-error` : undefined,
      invalid,
      required,
      disabled,
    }),
    [base, described, invalid, required, disabled],
  );

  return (
    <FormFieldContext value={value}>
      <div className={cn("flex flex-col gap-2", className)} {...props}>
        <Label
          id={value.labelId}
          htmlFor={value.controlId}
          required={required}
          className={cn(hideLabel && "sr-only")}
        >
          {label}
        </Label>

        {children}

        {description ? (
          <p id={value.descriptionId} className="text-sm text-content-muted">
            {description}
          </p>
        ) : null}

        {/* `aria-describedby` reads the visible error on focus. */}
        {invalid ? (
          <p id={value.errorId} className="text-sm font-medium text-danger-fg">
            {error}
          </p>
        ) : null}

        {/* A mounted live region announces errors added after render. */}
        <div aria-live="polite" className="sr-only">
          {error}
        </div>
      </div>
    </FormFieldContext>
  );
}
