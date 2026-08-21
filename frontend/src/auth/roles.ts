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
export const ACCOUNTANT_ROLE = 'ACCOUNTANT'
export const CLASS_TEACHER_ROLE = 'CLASS_TEACHER'
export const SUBJECT_TEACHER_ROLE = 'SUBJECT_TEACHER'
export const ASSISTANT_HEADTEACHER_ROLE = 'ASSISTANT_HEADTEACHER'

/** Parent Portal identity (a provisioned Guardian account, not a staff RBAC role). */
export const PARENT_ROLE = 'PARENT'

/** Roles that use the teacher portal (`/teacher`). */
export const TEACHER_ROLES = [CLASS_TEACHER_ROLE, SUBJECT_TEACHER_ROLE] as const

/** Permission keys that may only ever belong to the OWNER role. */
export const OWNER_ONLY_PERMISSIONS = [
  'owner.manage',
  'owner.create',
  'owner.change',
  'owner.delete',
] as const

/** Fees & Finance permissions (phase 5). */
export const FINANCE_VIEW = 'finance.view'
export const FINANCE_MANAGE = 'finance.manage'
export const FEES_MANAGE = 'fees.manage'
export const PAYMENTS_RECORD = 'payments.record'
export const ACADEMIC_VIEW = 'academic.view'

/** Academic (phase 6) permissions. */
export const TEACHERS_VIEW = 'teachers.view'
export const TEACHERS_MANAGE = 'teachers.manage'
export const SUBJECTS_VIEW = 'subjects.view'
export const SUBJECTS_MANAGE = 'subjects.manage'
export const ASSIGNMENTS_MANAGE = 'assignments.manage'
export const SBA_VIEW = 'sba.view'
export const SBA_MANAGE = 'sba.manage'

/** Phase 7 — terminal reports & parent accounts permissions. */
export const REPORTS_VIEW = 'reports.view'
export const GUARDIANS_VIEW = 'guardians.view'
export const GUARDIANS_MANAGE = 'guardians.manage'

/** Phase 9 — notifications & announcements permissions. */
export const NOTIFICATIONS_VIEW = 'notifications.view'
export const NOTIFICATIONS_MANAGE = 'notifications.manage'
export const ANNOUNCEMENTS_VIEW = 'announcements.view'
export const ANNOUNCEMENTS_MANAGE = 'announcements.manage'

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

/**
 * Portal base path for the highest applicable role. Shared pages (e.g. the
 * finance module) use this to build cross-portal links.
 */
export function portalBasePath(roles: string[]): string {
  if (roles.includes(OWNER_ROLE)) return '/owner'
  if (roles.includes(HEADTEACHER_ROLE)) return '/headteacher'
  if (roles.includes(ACCOUNTANT_ROLE)) return '/accountant'
  if (TEACHER_ROLES.some((role) => roles.includes(role))) return '/teacher'
  return '/login'
}