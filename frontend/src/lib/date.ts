/**
 * Formats an ISO date string (e.g. "2026-03-14") as "14 Mar 2026".
 */
export function formatDate(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

/**
 * Returns the school-day number for `today` within the active term.
 *
 * PRPS uses inclusive counting: the term start date is Day 1.  Every
 * subsequent eligible school day (Mon–Fri) increments the number.
 *
 * When `configuredTotal` is provided the result is capped so the number
 * never exceeds the total school days in the term.
 *
 * Returns 0 when:
 *  – `termStart` is invalid
 *  – `today` is before `termStart`
 */
export function elapsedSchoolDays(
  termStart: string,
  today: Date = new Date(),
  configuredTotal?: number,
): number {
  const parts = termStart.split('T')[0].split('-')
  if (parts.length !== 3) return 0
  const startY = Number(parts[0])
  const startM = Number(parts[1]) - 1
  const startD = Number(parts[2])
  if (Number.isNaN(startY) || Number.isNaN(startM) || Number.isNaN(startD)) return 0

  const start = new Date(startY, startM, startD)
  const end = new Date(today.getFullYear(), today.getMonth(), today.getDate())

  if (end.getTime() < start.getTime()) return 0

  let count = 0
  const cursor = new Date(start)
  while (cursor.getTime() <= end.getTime()) {
    const dow = cursor.getDay()
    if (dow !== 0 && dow !== 6) count++
    cursor.setDate(cursor.getDate() + 1)
  }

  if (configuredTotal !== undefined && configuredTotal > 0 && count > configuredTotal) {
    count = configuredTotal
  }

  return count
}

/**
 * Returns a human-readable school-day label, e.g. "2 school days" or
 * "1 school day".
 */
export function schoolDayLabel(count: number): string {
  return `${count} school day${count === 1 ? '' : 's'}`
}

/**
 * Enumerates the school days (Mon–Fri) between `termStart` and `termEnd`,
 * inclusive, as `yyyy-mm-dd` strings.
 *
 * Uses the same PRPS school-day rule as `elapsedSchoolDays`: the term start
 * date is Day 1 when it falls on a weekday; weekends are never counted.
 * Returns an empty array when either date is invalid or the range is empty.
 * The list is capped at 400 school days as a safety guard.
 */
export function schoolDaysBetween(termStart: string, termEnd: string): string[] {
  const parse = (iso: string): Date | null => {
    const parts = iso.split('T')[0].split('-')
    if (parts.length !== 3) return null
    const year = Number(parts[0])
    const month = Number(parts[1]) - 1
    const day = Number(parts[2])
    if (Number.isNaN(year) || Number.isNaN(month) || Number.isNaN(day)) return null
    const date = new Date(year, month, day)
    return Number.isNaN(date.getTime()) ? null : date
  }

  const start = parse(termStart)
  const end = parse(termEnd)
  if (!start || !end || end.getTime() < start.getTime()) return []

  const days: string[] = []
  const cursor = new Date(start)
  while (cursor.getTime() <= end.getTime() && days.length < 400) {
    const dow = cursor.getDay()
    if (dow !== 0 && dow !== 6) {
      const year = cursor.getFullYear()
      const month = String(cursor.getMonth() + 1).padStart(2, '0')
      const day = String(cursor.getDate()).padStart(2, '0')
      days.push(`${year}-${month}-${day}`)
    }
    cursor.setDate(cursor.getDate() + 1)
  }
  return days
}
