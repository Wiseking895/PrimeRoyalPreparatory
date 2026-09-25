import { staffPositionByKey } from '@/auth/roles'

/**
 * Display-only role labels. Mirrors the authoritative backend RBAC catalog
 * (`backend/src/rbac/catalog.ts` ROLE_DEFINITIONS labels) for presentation.
 * This map NEVER controls authorization — the backend remains the authority.
 */
const ROLE_LABELS: Record<string, string> = {
  OWNER: 'Owner',
  HEADTEACHER: 'Headteacher',
  ASSISTANT_HEADTEACHER: 'Assistant Headteacher',
  CLASS_TEACHER: 'Class Teacher',
  SUBJECT_TEACHER: 'Subject Teacher',
  ACCOUNTANT: 'Accountant / Finance',
  NON_TEACHING_STAFF: 'Non-Teaching Staff',
  ADMINISTRATIVE_STAFF: 'Administrative Staff',
  SUPPORT_STAFF: 'Support Staff',
  PARENT: 'Parent',
}

export function roleLabel(role: string): string {
  return ROLE_LABELS[role] ?? role.replace(/_/g, ' ')
}

/** Human-readable position label from the shared STAFF_POSITIONS catalog. */
export function positionDisplay(position?: string | null): string | undefined {
  if (!position) return undefined
  return staffPositionByKey(position)?.label ?? position
}

const CATEGORY_LABELS: Record<string, string> = {
  TEACHING: 'Teaching Staff',
  NON_TEACHING: 'Non-Teaching Staff',
  LEADERSHIP: 'Leadership',
}

export function categoryDisplay(category?: string | null): string | undefined {
  if (!category) return undefined
  return CATEGORY_LABELS[category] ?? category.replace(/_/g, ' ')
}
