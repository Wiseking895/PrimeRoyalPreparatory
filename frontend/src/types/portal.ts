/**
 * Portal API types — mirrors the shapes returned by the PRPS backend
 * (`backend/src/services/user-mapper.ts`, controllers and catalog services).
 * The backend remains authoritative; these types exist so the frontend never
 * has to reach for `any`.
 */

export interface PublicUser {
  id: string
  fullName: string
  email: string
  phone: string | null
  profilePictureUrl: string | null
  status: 'ACTIVE' | 'INACTIVE'
  lastLoginAt: string | null
  staffId: string | null
  roles: string[]
  permissions: string[]
}

export interface StaffView extends PublicUser {
  category: string | null
  address: string | null
  dateJoined: string | null
  responsibilities: string | null
}

export interface LoginResult {
  token: string
  user: PublicUser
}

export interface SetupStatus {
  ownerExists: boolean
}

export interface OwnerSetupInput {
  fullName: string
  email: string
  phone?: string
  password: string
  confirmPassword: string
}

export interface OwnerSummary {
  headteacher: PublicUser | null
  totals: {
    staff: number
    pupils: number
    classes: number
    admissions: number
    auditEntries: number
  }
}

export interface PermissionDefinition {
  key: string
  module: string
  moduleLabel: string
  label: string
  description?: string
}

export interface RoleDefinition {
  name: string
  label: string
  description: string
  permissions: string[]
}

export interface GroupedPermission {
  module: string
  moduleLabel: string
  permissions: Array<{
    key: string
    label: string
    description?: string
  }>
}

export interface AuditEntry {
  id: string
  action: string
  resourceType: string | null
  resourceId: string | null
  metadata: Record<string, unknown> | null
  ip: string | null
  createdAt: string
  actor: { id: string; fullName: string; email: string } | null
}

export interface AuditPage {
  entries: AuditEntry[]
  total: number
  limit: number
  offset: number
}

export interface CreateHeadteacherInput {
  firstName: string
  lastName: string
  email: string
  phone?: string
  address?: string
  password: string
  confirmPassword: string
  status?: 'ACTIVE' | 'INACTIVE'
}

export interface UpdateHeadteacherInput {
  firstName?: string
  lastName?: string
  email?: string
  phone?: string
  address?: string
}

export interface CreateStaffInput {
  firstName: string
  lastName: string
  email: string
  phone?: string
  address?: string
  roleName?: string
  category?: 'TEACHING' | 'NON_TEACHING'
  password: string
  confirmPassword: string
}

export interface UpdateStaffInput {
  firstName?: string
  lastName?: string
  email?: string
  phone?: string
  address?: string
  category?: 'TEACHING' | 'NON_TEACHING'
  responsibilities?: string
}
