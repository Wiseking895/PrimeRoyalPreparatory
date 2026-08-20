import type { GuardianIdentity } from '../types/auth'

/**
 * Guardian / parent-portal view DTOs. Never expose `passwordHash` or the
 * temporary credential. `accountEmail` is the login email; the contact `email`
 * may be shared across guardians and is never used for login.
 */

/** Identity attached to parent-portal requests by `requireParentAuth`. */
export function toGuardianIdentity(record: {
  id: string
  fullName: string
  email: string | null
  phone: string | null
  status: string
  mustChangePassword: boolean
}): GuardianIdentity {
  return {
    id: record.id,
    fullName: record.fullName,
    email: record.email,
    phone: record.phone,
    status: record.status,
    mustChangePassword: record.mustChangePassword,
  }
}

export interface ParentProfileView {
  id: string
  fullName: string
  email: string | null
  phone: string | null
  status: string
  mustChangePassword: boolean
  lastLoginAt: string | null
  createdAt: string
  linkedPupilCount: number
}

export function toParentProfile(record: {
  id: string
  fullName: string
  email: string | null
  phone: string | null
  accountEmail: string | null
  status: string
  mustChangePassword: boolean
  lastLoginAt: Date | null
  createdAt: Date
  pupilGuardians?: Array<{ pupilId: string }>
}): ParentProfileView {
  return {
    id: record.id,
    fullName: record.fullName,
    email: record.accountEmail ?? record.email,
    phone: record.phone,
    status: record.status,
    mustChangePassword: record.mustChangePassword,
    lastLoginAt: record.lastLoginAt?.toISOString() ?? null,
    createdAt: record.createdAt.toISOString(),
    linkedPupilCount: record.pupilGuardians?.length ?? 0,
  }
}

export interface GuardianView {
  id: string
  fullName: string
  phone: string | null
  email: string | null
  address: string | null
  accountEmail: string | null
  hasAccount: boolean
  accountStatus: 'ACTIVE' | 'INACTIVE'
  mustChangePassword: boolean
  lastLoginAt: string | null
  pupilCount: number
  createdAt: string
  updatedAt: string
}

export function toGuardianView(record: {
  id: string
  fullName: string
  phone: string | null
  email: string | null
  address: string | null
  accountEmail: string | null
  passwordHash: string | null
  status: 'ACTIVE' | 'INACTIVE'
  mustChangePassword: boolean
  lastLoginAt: Date | null
  createdAt: Date
  updatedAt: Date
  _count?: { pupilGuardians: number }
  pupilGuardians?: Array<{ pupilId: string }>
}): GuardianView {
  return {
    id: record.id,
    fullName: record.fullName,
    phone: record.phone,
    email: record.email,
    address: record.address,
    accountEmail: record.accountEmail,
    hasAccount: record.passwordHash !== null,
    accountStatus: record.status,
    mustChangePassword: record.mustChangePassword,
    lastLoginAt: record.lastLoginAt?.toISOString() ?? null,
    pupilCount: record._count?.pupilGuardians ?? record.pupilGuardians?.length ?? 0,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  }
}