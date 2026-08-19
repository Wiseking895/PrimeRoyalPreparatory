/**
 * School identity constants.
 *
 * The school name, abbreviation and motto are fixed identity facts for the
 * whole product. Kept in the backend so the health endpoint, database seed and
 * any future backend services use a single source of truth.
 */
export const SCHOOL = {
  name: 'Prime Royal Preparatory School',
  shortName: 'Prime Royal',
  abbreviation: 'P.R.P.S.',
  motto: 'EMPOWERMENT THROUGH EDUCATION',
  tagline:
    'Nurturing young minds with quality education, strong values, and a passion for excellence.',
} as const

/**
 * Core application information surfaced by the backend health endpoint.
 */
export const APP = {
  name: 'prps-school-management',
  description: 'Prime Royal Preparatory School Management System',
  version: '0.1.0',
} as const

/**
 * Default school classes / academic levels seeded into the database. These are
 * only the starting point — the school manages its own class structure through
 * the class management API, so the application never hard-codes class names.
 */
export const DEFAULT_CLASSES: ReadonlyArray<{
  key: string
  name: string
  sortOrder: number
  description: string
}> = [
  { key: 'NURSERY', name: 'Nursery', sortOrder: 1, description: 'Early years foundation.' },
  { key: 'KG', name: 'KG', sortOrder: 2, description: 'Kindergarten.' },
  { key: 'PRIMARY_1', name: 'Primary 1', sortOrder: 3, description: 'First primary class.' },
  { key: 'PRIMARY_2', name: 'Primary 2', sortOrder: 4, description: 'Second primary class.' },
  { key: 'PRIMARY_3', name: 'Primary 3', sortOrder: 5, description: 'Third primary class.' },
  { key: 'PRIMARY_4', name: 'Primary 4', sortOrder: 6, description: 'Fourth primary class.' },
  { key: 'PRIMARY_5', name: 'Primary 5', sortOrder: 7, description: 'Fifth primary class.' },
  { key: 'PRIMARY_6', name: 'Primary 6', sortOrder: 8, description: 'Sixth primary class.' },
]