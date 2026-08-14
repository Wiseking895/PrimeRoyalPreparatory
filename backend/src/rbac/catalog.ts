/**
 * Role-based access control catalog — the single source of truth for roles,
 * permissions and their default assignments. Owned by the backend.
 *
 * Used by:
 *   - database seed (upserts the catalog into PostgreSQL)
 *   - backend      (authorization + permission enforcement)
 *
 * The frontend keeps a small mirror of the string constants it renders
 * (role/permission keys); the backend catalog remains authoritative.
 *
 * The OWNER role is the root authority and always holds every permission.
 * Permissions in the `owner` module are NOT grantable to any other role.
 */

export const OWNER_ROLE = 'OWNER'
export const HEADTEACHER_ROLE = 'HEADTEACHER'

export const STAFF_CATEGORIES = {
  TEACHING: 'TEACHING',
  NON_TEACHING: 'NON_TEACHING',
  LEADERSHIP: 'LEADERSHIP',
} as const

/** Permission keys that may only ever belong to the OWNER role. */
export const OWNER_ONLY_PERMISSIONS = [
  'owner.manage',
  'owner.create',
  'owner.change',
  'owner.delete',
] as const

export interface PermissionDefinition {
  key: string
  /** Grouping module, e.g. `staff`. */
  module: string
  /** Human-readable group label shown in the UI, e.g. "Staff Management". */
  moduleLabel: string
  /** Human-readable label, e.g. "Create Staff Accounts". */
  label: string
  description?: string
}

export interface RoleDefinition {
  name: string
  label: string
  description: string
  /** Default permission keys assigned when the role is first created. */
  permissions: string[]
}

/**
 * Canonical permission catalog. Later phases may append new permission keys
 * (e.g. `fees.collect`, `sba.submit`) — the backend only ever resolves keys
 * present in this catalog.
 */
export const PERMISSIONS: PermissionDefinition[] = [
  // Staff management
  { key: 'staff.view', module: 'staff', moduleLabel: 'Staff Management', label: 'View Staff' },
  { key: 'staff.create', module: 'staff', moduleLabel: 'Staff Management', label: 'Create Staff Accounts' },
  { key: 'staff.update', module: 'staff', moduleLabel: 'Staff Management', label: 'Update Staff Accounts' },
  { key: 'staff.assign_role', module: 'staff', moduleLabel: 'Staff Management', label: 'Assign Staff Roles' },
  { key: 'staff.remove_role', module: 'staff', moduleLabel: 'Staff Management', label: 'Remove Staff Roles' },
  { key: 'staff.manage', module: 'staff', moduleLabel: 'Staff Management', label: 'Manage Teaching & Non-Teaching Staff' },
  // Pupil management
  { key: 'pupils.view', module: 'pupils', moduleLabel: 'Pupil Management', label: 'View Pupils' },
  { key: 'pupils.create', module: 'pupils', moduleLabel: 'Pupil Management', label: 'Create Pupils' },
  { key: 'pupils.update', module: 'pupils', moduleLabel: 'Pupil Management', label: 'Update Pupils' },
  // Class management
  { key: 'classes.view', module: 'classes', moduleLabel: 'Class Management', label: 'View Classes' },
  { key: 'classes.manage', module: 'classes', moduleLabel: 'Class Management', label: 'Manage Classes' },
  // Admissions
  { key: 'admissions.view', module: 'admissions', moduleLabel: 'Admissions', label: 'View Admissions' },
  { key: 'admissions.manage', module: 'admissions', moduleLabel: 'Admissions', label: 'Manage Admissions' },
  // Attendance
  { key: 'attendance.view', module: 'attendance', moduleLabel: 'Attendance', label: 'View Attendance' },
  { key: 'attendance.manage', module: 'attendance', moduleLabel: 'Attendance', label: 'Manage Attendance' },
  // Reports
  { key: 'reports.view', module: 'reports', moduleLabel: 'Reports', label: 'View Reports' },
  { key: 'reports.manage', module: 'reports', moduleLabel: 'Reports', label: 'Manage Reports' },
  // Academic administration
  { key: 'academic.view', module: 'academic', moduleLabel: 'Academic Administration', label: 'View Academic Administration' },
  { key: 'academic.manage', module: 'academic', moduleLabel: 'Academic Administration', label: 'Manage Academic Administration' },
  // Audit
  { key: 'audit.view', module: 'audit', moduleLabel: 'Audit Log', label: 'View Audit Log' },
  // System administration — OWNER only. Never grantable to any other role.
  { key: 'owner.manage', module: 'owner', moduleLabel: 'System Administration', label: 'Manage Owner Account', description: 'OWNER only. Not grantable to other roles.' },
  { key: 'owner.create', module: 'owner', moduleLabel: 'System Administration', label: 'Create Owner', description: 'OWNER only. Not grantable to other roles.' },
  { key: 'owner.change', module: 'owner', moduleLabel: 'System Administration', label: 'Change Owner', description: 'OWNER only. Not grantable to other roles.' },
  { key: 'owner.delete', module: 'owner', moduleLabel: 'System Administration', label: 'Delete Owner', description: 'OWNER only. Not grantable to other roles.' },
]

/**
 * Predefined roles with their default permission sets.
 *
 * The Owner and Headteacher defaults represent the school's operational
 * administrator; the Owner can always reduce or modify the Headteacher's
 * permissions afterwards. Roles created with empty defaults gain their module
 * permissions in later phases.
 */
export const ROLE_DEFINITIONS: RoleDefinition[] = [
  {
    name: OWNER_ROLE,
    label: 'Owner',
    description: 'Root administrative authority for this school instance.',
    permissions: PERMISSIONS.map((p) => p.key),
  },
  {
    name: HEADTEACHER_ROLE,
    label: 'Headteacher',
    description: 'School operational administrator, delegating authority from the Owner.',
    permissions: [
      'staff.view',
      'staff.create',
      'staff.update',
      'staff.assign_role',
      'staff.remove_role',
      'staff.manage',
      'pupils.view',
      'pupils.create',
      'pupils.update',
      'classes.view',
      'classes.manage',
      'admissions.view',
      'admissions.manage',
      'attendance.view',
      'attendance.manage',
      'reports.view',
      'reports.manage',
      'academic.view',
      'academic.manage',
    ],
  },
  {
    name: 'ASSISTANT_HEADTEACHER',
    label: 'Assistant Headteacher',
    description: 'Support school leadership and daily operations with read-mostly access.',
    permissions: [
      'staff.view',
      'pupils.view',
      'pupils.create',
      'classes.view',
      'admissions.view',
      'attendance.view',
      'reports.view',
      'academic.view',
    ],
  },
  {
    name: 'CLASS_TEACHER',
    label: 'Class Teacher',
    description: 'Teaching staff responsible for a class. Academic scope arrives in later phases.',
    permissions: [],
  },
  {
    name: 'SUBJECT_TEACHER',
    label: 'Subject Teacher',
    description: 'Teaching staff responsible for specific subjects. Academic scope arrives in later phases.',
    permissions: [],
  },
  {
    name: 'ACCOUNTANT',
    label: 'Accountant',
    description: 'School finance role. Fee and billing scope arrives in later phases.',
    permissions: [],
  },
  {
    name: 'NON_TEACHING_STAFF',
    label: 'Non-Teaching Staff',
    description: 'General non-teaching staff account.',
    permissions: [],
  },
  {
    name: 'ADMINISTRATIVE_STAFF',
    label: 'Administrative Staff',
    description: 'Non-teaching staff focused on administrative duties.',
    permissions: [],
  },
  {
    name: 'SUPPORT_STAFF',
    label: 'Support Staff',
    description: 'Non-teaching staff focused on school support duties.',
    permissions: [],
  },
]

/** Roles a Headteacher (never the Owner or another Headteacher) may assign. */
export const ASSIGNABLE_STAFF_ROLES: string[] = ROLE_DEFINITIONS.filter(
  (role) => role.name !== OWNER_ROLE && role.name !== HEADTEACHER_ROLE,
).map((role) => role.name)

export function permissionByKey(key: string): PermissionDefinition | undefined {
  return PERMISSIONS.find((permission) => permission.key === key)
}

export function roleByKey(name: string): RoleDefinition | undefined {
  return ROLE_DEFINITIONS.find((role) => role.name === name)
}