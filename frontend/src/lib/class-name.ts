/**
 * Single source of truth for class display names on the client.
 *
 * Mirrors `backend/src/lib/class-name.ts`: division is optional, so an
 * undivided class displays as its level alone ("Nursery 1") and a divided
 * class appends the letter without a space ("Nursery 1A"). The backend
 * stores this composed string in `SchoolClass.name`, which every view
 * already renders.
 */

export const CLASS_DIVISIONS = ['A', 'B', 'C', 'D'] as const

export type ClassDivision = (typeof CLASS_DIVISIONS)[number]

/** Select value representing "no division". */
export const UNDIVIDED_DIVISION = 'UNDIVIDED'

export function normalizeDivision(value?: string | null): ClassDivision | null {
  if (value === undefined || value === null) return null
  const trimmed = value.trim()
  if (trimmed === '' || trimmed.toUpperCase() === UNDIVIDED_DIVISION) return null
  const upper = trimmed.toUpperCase()
  return (CLASS_DIVISIONS as readonly string[]).includes(upper) ? (upper as ClassDivision) : null
}

/** The one display rule: `${classLevel}${division}` or just `classLevel`. */
export function formatClassName(classLevel: string, division?: string | null): string {
  const level = classLevel.trim()
  const normalized = normalizeDivision(division)
  return normalized ? `${level}${normalized}` : level
}

/** Recovers the class level from a stored display name + division. */
export function getClassLevel(name: string, division?: string | null): string {
  const normalized = normalizeDivision(division)
  if (normalized && name.endsWith(normalized) && name.length > normalized.length) {
    return name.slice(0, -normalized.length)
  }
  return name
}

/** Stored division -> select value ("UNDIVIDED" | "A" | ... | "D"). */
export function toDivisionValue(division?: string | null): string {
  return normalizeDivision(division) ?? UNDIVIDED_DIVISION
}

/** Select value -> API payload (null = undivided). */
export function toDivisionPayload(value: string): ClassDivision | null {
  return normalizeDivision(value)
}
