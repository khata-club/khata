import { addMonthsToDate, daysBetween, parseISO, type ISODate } from './dates'
import { FREQUENCY_MONTHS, type Frequency } from './constants'

/** Next due date after `due`, keeping the original day of month where possible. */
export function nextDueDate(due: ISODate, frequency: Frequency, anchorDay?: number): ISODate {
  return addMonthsToDate(due, FREQUENCY_MONTHS[frequency], anchorDay ?? parseISO(due).day)
}

/** Monthly amount still needed to reach a goal by its date (whole months, at least 1). */
export function monthlyNeeded(
  target: number,
  saved: number,
  targetDate: ISODate | null,
  today: ISODate,
): number | null {
  const left = target - saved
  if (left <= 0) return 0
  if (!targetDate) return null
  const months = Math.max(1, Math.ceil(daysBetween(today, targetDate) / 30.44))
  return Math.ceil(left / months)
}

export type DueState = 'overdue' | 'today' | 'soon' | 'later'

export function dueState(due: ISODate, today: ISODate, soonDays = 7): DueState {
  const d = daysBetween(today, due)
  if (d < 0) return 'overdue'
  if (d === 0) return 'today'
  if (d <= soonDays) return 'soon'
  return 'later'
}

/** Bucket counts for analytics, never raw values: "0", "1-10", "11-100", "101-1000", "1000+". */
export function bucket(n: number): string {
  if (n <= 0) return '0'
  if (n <= 10) return '1-10'
  if (n <= 100) return '11-100'
  if (n <= 1000) return '101-1000'
  return '1000+'
}
