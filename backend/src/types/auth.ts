import type { Request } from 'express'

/**
 * Resolved identity attached to authenticated requests by `requireAuth`.
 * Roles and permissions are always materialized from the database — never
 * taken from a client-supplied value.
 */
export interface AuthenticatedUser {
  id: string
  fullName: string
  email: string
  phone: string | null
  status: string
  staffId: string | null
  roleNames: string[]
  permissionKeys: string[]
}

export interface AuthRequest extends Request {
  user?: AuthenticatedUser
}

/**
 * Resolved identity attached to parent-portal requests by
 * `requireParentAuth`. Parents are Guardians with a provisioned account; they
 * are a separate identity class from staff and never carry roles/permissions.
 */
export interface GuardianIdentity {
  id: string
  fullName: string
  email: string | null
  phone: string | null
  status: string
  mustChangePassword: boolean
}

export interface ParentRequest extends Request {
  parent?: GuardianIdentity
}