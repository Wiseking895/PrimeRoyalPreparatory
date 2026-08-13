import { PERMISSIONS, ROLE_DEFINITIONS } from '@prps/shared'
import { prisma } from '../lib/prisma'

/**
 * Idempotently ensures the role/permission catalog exists in the database.
 * Runs on backend startup and defensively from the owner setup flow. Roles
 * that already have permissions are left untouched so Owner-adjusted
 * Headteacher permissions survive restarts.
 */
export async function ensureInitialRbac(): Promise<void> {
  const permissionIds = new Map<string, string>()
  for (const permission of PERMISSIONS) {
    const record = await prisma.permission.upsert({
      where: { key: permission.key },
      update: {
        label: permission.label,
        module: permission.module,
        description: permission.description ?? null,
      },
      create: {
        key: permission.key,
        label: permission.label,
        module: permission.module,
        description: permission.description ?? null,
        isSystem: true,
      },
    })
    permissionIds.set(permission.key, record.id)
  }

  const roleIds = new Map<string, string>()
  for (const role of ROLE_DEFINITIONS) {
    const record = await prisma.role.upsert({
      where: { name: role.name },
      update: { description: role.description },
      create: { name: role.name, description: role.description, isSystem: true },
    })
    roleIds.set(role.name, record.id)
  }

  for (const role of ROLE_DEFINITIONS) {
    const roleId = roleIds.get(role.name)
    if (!roleId) continue
    const existing = await prisma.rolePermission.count({ where: { roleId } })
    if (existing > 0) continue
    const keys = role.name === 'OWNER' ? PERMISSIONS.map((p) => p.key) : role.permissions
    const assignments = keys
      .map((key) => permissionIds.get(key))
      .filter((permissionId): permissionId is string => Boolean(permissionId))
      .map((permissionId) => ({ roleId, permissionId }))
    if (assignments.length > 0) {
      await prisma.rolePermission.createMany({ data: assignments })
    }
  }
}