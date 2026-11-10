/** Status tone shared by KAlert and KNotificationPanel. */
export type Tone = 'primary' | 'success' | 'warning' | 'danger'

/** Soft icon badge per tone (tinted circle with a coloured icon). */
export const softBadgeClasses: Record<Tone, string> = {
  primary: 'bg-primary-subtle text-primary',
  success: 'bg-success-subtle text-success',
  warning: 'bg-warning-subtle text-warning',
  danger: 'bg-danger-subtle text-danger',
}
