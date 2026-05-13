/**
 * Shared date helpers used across both server and client components.
 *
 * These are pure functions — no database calls, no browser APIs.
 * Safe to import anywhere in the app.
 */

/** Today's date as 'YYYY-MM-DD' in the given IANA timezone. */
export function todayLocal(tz: string): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: tz })
}

/** Today's date as 'YYYY-MM-DD' in Pacific time. Use todayLocal(tz) when org timezone is available. */
export function todayPT(): string {
  return todayLocal('America/Los_Angeles')
}

/**
 * Format a date range for display.
 *
 * Single day:         "Monday, May 10, 2026"
 * Same month:         "May 10 – 14, 2026"
 * Different month:    "May 28 – June 3, 2026"
 * Different year:     "Dec 20, 2025 – Jan 5, 2026"
 */
export function formatDateRange(startDate: string, endDate: string | null): string {
  const start = new Date(startDate + 'T12:00:00')

  if (!endDate || endDate === startDate) {
    return start.toLocaleDateString('en-US', {
      weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
    })
  }

  const end = new Date(endDate + 'T12:00:00')

  if (start.getFullYear() !== end.getFullYear()) {
    return (
      start.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) +
      ' – ' +
      end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    )
  }

  if (start.getMonth() !== end.getMonth()) {
    return (
      start.toLocaleDateString('en-US', { month: 'long', day: 'numeric' }) +
      ' – ' +
      end.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
    )
  }

  // Same month — "May 10 – 14, 2026"
  return (
    start.toLocaleDateString('en-US', { month: 'long', day: 'numeric' }) +
    ` – ${end.getDate()}, ${end.getFullYear()}`
  )
}

/**
 * Short date range for compact list views.
 *
 * Single day:      "May 10"
 * Same month:      "May 10 – 14"
 * Different month: "May 28 – Jun 3"
 */
export function formatDateRangeShort(startDate: string, endDate: string | null): string {
  const start = new Date(startDate + 'T12:00:00')

  if (!endDate || endDate === startDate) {
    return start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  const end = new Date(endDate + 'T12:00:00')

  if (start.getMonth() === end.getMonth()) {
    return `${start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${end.getDate()}`
  }

  return (
    start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) +
    ' – ' +
    end.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  )
}

/**
 * Count the number of school days (Mon–Fri) in a date range, inclusive.
 * Returns 1 for a single day or when endDate is null.
 */
export function countWeekdays(startDate: string, endDate: string | null): number {
  if (!endDate || endDate === startDate) return 1
  const start = new Date(startDate + 'T12:00:00')
  const end = new Date(endDate + 'T12:00:00')
  let count = 0
  const current = new Date(start)
  while (current <= end) {
    const day = current.getDay()
    if (day !== 0 && day !== 6) count++ // skip Sunday (0) and Saturday (6)
    current.setDate(current.getDate() + 1)
  }
  return count
}
