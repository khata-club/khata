import type { FieldStatus } from './types'

/**
 * Shared field styling for text-like controls: a filled, borderless well. The well carries the
 * focus ring (via :focus-within) so prefixes, icons and actions sit inside it. Status shows as an
 * inner ring plus an icon — never colour alone.
 */
export function wellClasses(status: FieldStatus, disabled: boolean, readonly: boolean): string[] {
  const base = [
    'relative flex w-full min-w-0 items-center rounded-md transition-[background-color,box-shadow] duration-(--duration-normal) ease-out',
  ]
  if (disabled) return [...base, 'cursor-not-allowed bg-fill-tertiary text-label opacity-50']
  if (readonly) {
    return [
      ...base,
      'bg-transparent text-label shadow-[inset_0_0_0_1px_var(--color-separator)] focus-within:shadow-[0_0_0_1px_var(--color-tint),0_0_0_4px_var(--color-accent-soft)]',
    ]
  }
  // Literal class strings, so Tailwind's scanner sees every one.
  const byStatus: Record<FieldStatus, string> = {
    default:
      'bg-fill-tertiary hover:bg-fill-secondary focus-within:bg-surface focus-within:shadow-[0_0_0_1px_var(--color-tint),0_0_0_4px_var(--color-accent-soft)]',
    loading:
      'bg-fill-tertiary focus-within:bg-surface focus-within:shadow-[0_0_0_1px_var(--color-tint),0_0_0_4px_var(--color-accent-soft)]',
    valid:
      'bg-fill-tertiary focus-within:bg-surface focus-within:shadow-[0_0_0_1px_var(--color-tint),0_0_0_4px_var(--color-accent-soft)]',
    warning:
      'bg-surface shadow-[inset_0_0_0_1.5px_var(--color-warning)] focus-within:shadow-[0_0_0_1px_var(--color-warning),0_0_0_4px_var(--color-warning-soft)]',
    error:
      'bg-surface shadow-[inset_0_0_0_1.5px_var(--color-negative)] focus-within:shadow-[0_0_0_1px_var(--color-negative),0_0_0_4px_var(--color-negative-soft)]',
  }
  return [...base, 'text-label', byStatus[status]]
}

export const messageColor: Record<FieldStatus | 'disabled', string> = {
  default: 'text-label-secondary',
  loading: 'text-label-secondary',
  valid: 'text-positive',
  warning: 'text-warning',
  error: 'text-negative',
  disabled: 'text-label-secondary',
}
