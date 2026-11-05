import type { FieldStatus } from './types'

/**
 * Shared "well" styling for text-like controls. The well is the element that carries the border,
 * so prefixes, icons and actions sit inside it; focus is tracked with :focus-within.
 */
export function wellClasses(status: FieldStatus, disabled: boolean, readonly: boolean): string[] {
  const base = [
    'relative flex w-full min-w-0 items-center rounded-md border-[1.5px] transition-[border-color,box-shadow,background-color] duration-(--duration-normal) ease-standard',
  ]
  if (disabled) {
    return [
      ...base,
      'cursor-not-allowed border-dashed border-line-control bg-surface-recessed text-fg-disabled shadow-none',
    ]
  }
  if (readonly) {
    return [
      ...base,
      'border-line bg-surface-subtle text-fg shadow-none focus-within:border-primary',
    ]
  }
  const byStatus: Record<FieldStatus, string> = {
    default:
      'border-line-control bg-surface-subtle shadow-recessed hover:border-gray-600 focus-within:border-primary focus-within:bg-surface focus-within:shadow-recessed-focus hover:focus-within:border-primary',
    loading:
      'border-line-control bg-surface shadow-recessed focus-within:border-primary focus-within:shadow-recessed-focus',
    valid:
      'border-success bg-surface shadow-recessed focus-within:border-primary focus-within:shadow-recessed-focus',
    warning: 'border-warning bg-surface shadow-recessed focus-within:shadow-recessed-warning-focus',
    error: 'border-danger bg-surface shadow-recessed focus-within:shadow-recessed-danger-focus',
  }
  return [...base, 'text-fg', byStatus[status]]
}

export const messageColor: Record<FieldStatus | 'disabled', string> = {
  default: 'text-fg-muted',
  loading: 'text-fg-muted',
  valid: 'text-success',
  warning: 'text-warning',
  error: 'text-danger',
  disabled: 'text-fg-disabled',
}
