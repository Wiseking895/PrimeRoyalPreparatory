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