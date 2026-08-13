export interface RolePayload {
  role: {
    name: string
    rolePermissions: Array<{ permission: { key: string } }>
  }
}

/** Shape of a user with roles + permissions + staff profile (as returned by Prisma includes). */
export interface UserRecord {
  id: string
  fullName: string
  email: string
  phone: string | null
  profilePictureUrl: string | null
  status: string
  lastLoginAt: Date | null
  staffProfile: {
    staffId: string
    category: string | null
    address: string | null
    dateJoined: Date
    responsibilities: string | null
    createdAt: Date
  } | null
  roles: RolePayload[]
}

export interface PublicUser {
  id: string
  fullName: string
  email: string
  phone: string | null
  profilePictureUrl: string | null
  status: string
  lastLoginAt: string | null
  staffId: string | null
  roles: string[]
  permissions: string[]
}

export interface StaffView {
  id: string
  fullName: string
  email: string
  phone: string | null
  profilePictureUrl: string | null
  status: string
  lastLoginAt: string | null
  staffId: string | null
  category: string | null
  address: string | null
  dateJoined: string | null
  responsibilities: string | null
  roles: string[]
  permissions: string[]
}

export function roleNamesOf(record: Pick<UserRecord, 'roles'>): string[] {
  return record.roles.map(({ role }) => role.name)
}

export function permissionKeysOf(record: Pick<UserRecord, 'roles'>): string[] {
  return Array.from(
    new Set(record.roles.flatMap(({ role }) => role.rolePermissions.map(({ permission }) => permission.key))),
  )
}

export function toPublicUser(record: UserRecord): PublicUser {
  return {
    id: record.id,
    fullName: record.fullName,
    email: record.email,
    phone: record.phone,
    profilePictureUrl: record.profilePictureUrl,
    status: record.status,
    lastLoginAt: record.lastLoginAt?.toISOString() ?? null,
    staffId: record.staffProfile?.staffId ?? null,
    roles: roleNamesOf(record),
    permissions: permissionKeysOf(record),
  }
}

export function toStaffView(record: UserRecord): StaffView {
  return {
    id: record.id,
    fullName: record.fullName,
    email: record.email,
    phone: record.phone,
    profilePictureUrl: record.profilePictureUrl,
    status: record.status,
    lastLoginAt: record.lastLoginAt?.toISOString() ?? null,
    staffId: record.staffProfile?.staffId ?? null,
    category: record.staffProfile?.category ?? null,
    address: record.staffProfile?.address ?? null,
    dateJoined: record.staffProfile?.dateJoined.toISOString() ?? null,
    responsibilities: record.staffProfile?.responsibilities ?? null,
    roles: roleNamesOf(record),
    permissions: permissionKeysOf(record),
  }
}