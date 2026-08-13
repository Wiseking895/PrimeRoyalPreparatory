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