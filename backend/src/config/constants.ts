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