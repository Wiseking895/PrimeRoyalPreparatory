/**
 * Single source of truth for class display names.
 *
 * Division is optional: when absent the class displays as its level alone
 * ("Nursery 1"); when present the division is appended without a space
 * ("Nursery 1A"). The composed string is stored in `SchoolClass.name`, which
 * every read path (pupil, finance, attendance, reports, dashboards,
 * selectors) already renders — so display stays consistent everywhere.
 */

export const CLASS_DIVISIONS = ['A', 'B', 'C', 'D'] as const

export type ClassDivision = (typeof CLASS_DIVISIONS)[number]

export function isClassDivision(value: unknown): value is ClassDivision {
  return typeof value === 'string' && (CLASS_DIVISIONS as readonly string[]).includes(value)
}

/** Normalizes a division input to `null` (undivided) or an upper-case A–D. */
export function normalizeDivision(value?: string | null): ClassDivision | null {
  if (value === undefined || value === null) return null
  const trimmed = value.trim()
  if (trimmed === '' || trimmed.toUpperCase() === 'UNDIVIDED') return null
  const upper = trimmed.toUpperCase()
  if (!isClassDivision(upper)) {
    throw new Error(`Invalid class division: ${value}`)
  }
  return upper
}

/**
 * The one display rule:
 *   division present  -> `${classLevel}${division}`  (e.g. "Nursery 1" + "A" -> "Nursery 1A")
 *   division absent   -> `classLevel`                (e.g. "Nursery 1")
 */
export function formatClassName(classLevel: string, division?: string | null): string {
  const level = classLevel.trim()
  const normalized = normalizeDivision(division)
  return normalized ? `${level}${normalized}` : level
}

/**
 * Recovers the class level from a stored display name + division.
 * Legacy rows (division = null) keep their name as the level unchanged.
 */
export function splitClassName(
  name: string,
  division?: string | null,
): { classLevel: string; division: ClassDivision | null } {
  const normalized = normalizeDivision(division)
  if (normalized && name.endsWith(normalized) && name.length > normalized.length) {
    return { classLevel: name.slice(0, -normalized.length), division: normalized }
  }
  return { classLevel: name, division: normalized }
}
