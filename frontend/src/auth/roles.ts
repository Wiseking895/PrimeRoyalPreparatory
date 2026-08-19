/**
 * Role/permission string constants rendered by the frontend.
 *
 * These mirror the authoritative RBAC catalog owned by the backend
 * (`backend/src/rbac/catalog.ts`). The backend enforces authorization; the
 * frontend uses these keys only for display and UI decisions. Keep the two
 * lists in sync when a phase changes the catalog.
 */

export const OWNER_ROLE = 'OWNER'
export const HEADTEACHER_ROLE = 'HEADTEACHER'

/** Permission keys that may only ever belong to the OWNER role. */
export const OWNER_ONLY_PERMISSIONS = [
  'owner.manage',
  'owner.create',
  'owner.change',
  'owner.delete',
] as const

/** Roles a Headteacher (never the Owner or another Headteacher) may assign. */
export const ASSIGNABLE_STAFF_ROLES: string[] = [
  'ASSISTANT_HEADTEACHER',
  'CLASS_TEACHER',
  'SUBJECT_TEACHER',
  'ACCOUNTANT',
  'NON_TEACHING_STAFF',
  'ADMINISTRATIVE_STAFF',
  'SUPPORT_STAFF',
]

export const STAFF_CATEGORIES = {
  TEACHING: 'TEACHING',
  NON_TEACHING: 'NON_TEACHING',
  LEADERSHIP: 'LEADERSHIP',
} as const

export interface StaffPosition {
  key: string
  label: string
  category: string
  role: string
}

/**
 * Staff positions offered by the school — mirrors the authoritative catalog
 * owned by the backend (`backend/src/rbac/catalog.ts`). Each position maps to a
 * staff category and a system role; the frontend uses these only for rendering
 * and form options, while the backend remains authoritative.
 */
export const STAFF_POSITIONS: StaffPosition[] = [
  { key: 'CLASS_TEACHER', label: 'Class Teacher', category: STAFF_CATEGORIES.TEACHING, role: 'CLASS_TEACHER' },
  { key: 'SUBJECT_TEACHER', label: 'Subject Teacher', category: STAFF_CATEGORIES.TEACHING, role: 'SUBJECT_TEACHER' },
  { key: 'ASSISTANT_HEADTEACHER', label: 'Assistant Headteacher', category: STAFF_CATEGORIES.NON_TEACHING, role: 'ASSISTANT_HEADTEACHER' },
  { key: 'GENERAL_SUPERVISOR', label: 'General Supervisor', category: STAFF_CATEGORIES.NON_TEACHING, role: 'ADMINISTRATIVE_STAFF' },
  { key: 'ACCOUNTANT', label: 'Accountant / Finance', category: STAFF_CATEGORIES.NON_TEACHING, role: 'ACCOUNTANT' },
  { key: 'CLEANER', label: 'Cleaner', category: STAFF_CATEGORIES.NON_TEACHING, role: 'SUPPORT_STAFF' },
  { key: 'COOK', label: 'Cook', category: STAFF_CATEGORIES.NON_TEACHING, role: 'SUPPORT_STAFF' },
  { key: 'DRIVER', label: 'Driver', category: STAFF_CATEGORIES.NON_TEACHING, role: 'SUPPORT_STAFF' },
  { key: 'BUS_CONDUCTOR', label: 'Bus Conductor', category: STAFF_CATEGORIES.NON_TEACHING, role: 'SUPPORT_STAFF' },
]

export function staffPositionByKey(key?: string | null): StaffPosition | undefined {
  if (!key) return undefined
  return STAFF_POSITIONS.find((position) => position.key === key)
}

export function positionLabel(key?: string | null): string {
  return staffPositionByKey(key)?.label ?? 'Staff'
}