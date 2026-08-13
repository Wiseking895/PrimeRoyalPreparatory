import { SCHOOL } from '@prps/shared'

/**
 * Frontend-only environment configuration. VITE_* values are embedded in the
 * browser bundle and must never contain secrets.
 */
export const apiBaseUrl = import.meta.env.VITE_API_URL ?? (import.meta.env.PROD ? '' : 'http://localhost:4000')

/**
 * School contact configuration.
 *
 * NOTE: The brief explicitly forbids inventing real contact information. These
 * values are clearly-labelled placeholders to be replaced when the school
 * supplies its official details.
 */
export const siteConfig = {
  name: SCHOOL.name,
  shortName: SCHOOL.shortName,
  abbreviation: SCHOOL.abbreviation,
  motto: SCHOOL.motto,
  contact: {
    address: 'School address to be confirmed',
    phone: 'School phone number to be confirmed',
    email: 'School email address to be confirmed',
    officeHours: 'Monday – Friday, 8:00 AM – 4:00 PM',
    locationNote: 'Map and directions to be confirmed',
  },
  social: {
    facebook: '#',
    instagram: '#',
    twitter: '#',
    whatsapp: '#',
  },
} as const
