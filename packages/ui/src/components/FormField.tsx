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

// Consumer bundlers replace this flag, as they do for React development checks.
declare const process: { env: { NODE_ENV?: string } };

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

type ControlReferences = {
  id?: string | undefined;
  "aria-describedby"?: string | undefined;
  "aria-invalid"?: ComponentPropsWithRef<"input">["aria-invalid"];
  "aria-required"?: ComponentPropsWithRef<"input">["aria-required"];
};

/** Accessibility props for controls inside a `FormField`. */
export function useFormField(props: ControlReferences = {}): {
  id: string | undefined;
  "aria-describedby": string | undefined;
  "aria-invalid": ControlReferences["aria-invalid"];
  "aria-required": ControlReferences["aria-required"];
  disabled: boolean | undefined;
} {
  const ctx = use(FormFieldContext);
  if (!ctx) {
    return {
      id: props.id,
      "aria-describedby": props["aria-describedby"],
      "aria-invalid": props["aria-invalid"],
      "aria-required": props["aria-required"],
      disabled: undefined,
    };
  }

  if (
    props.id !== undefined &&
    props.id !== ctx.controlId &&
    process.env.NODE_ENV !== "production"
  ) {
    throw new Error(
      "Control id conflicts with FormField. Set controlId on FormField instead.",
    );
  }

  /* Preserve help text when an error appears. */
  const describedBy =
    [
      ...new Set(
        [
          ctx.errorId,
          ctx.descriptionId,
          ...(props["aria-describedby"]?.split(/\s+/) ?? []),
        ].filter(Boolean),
      ),
    ].join(" ") || undefined;

  return {
    id: ctx.controlId,
    "aria-describedby": describedBy,
    "aria-invalid": ctx.invalid || props["aria-invalid"],
    "aria-required": ctx.required || props["aria-required"],
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
  /** Canonical control ID; set this instead of an ID on the child. */
  controlId?: string;
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
  controlId,
  ...props
}: FormFieldProps) {
  const base = useId();
  const invalid = Boolean(error);
  const described = Boolean(description);

  /* React nodes are often recreated when their presence is unchanged. */
  const value = useMemo<FormFieldContextValue>(
    () => ({
      controlId: controlId ?? `${base}-control`,
      labelId: `${base}-label`,
      descriptionId: described ? `${base}-description` : undefined,
      errorId: invalid ? `${base}-error` : undefined,
      invalid,
      required,
      disabled,
    }),
    [base, controlId, described, invalid, required, disabled],
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
