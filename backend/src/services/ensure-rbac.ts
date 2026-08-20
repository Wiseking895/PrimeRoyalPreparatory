import { OWNER_ROLE, PERMISSIONS, ROLE_DEFINITIONS, permissionByKey } from '../rbac/catalog'
import { prisma } from '../lib/prisma'

/**
 * Idempotently ensures the role/permission catalog exists in the database.
 * Runs on backend startup and defensively from the owner setup flow.
 *
 * Sync rules (all add-only — permissions are never removed here):
 *   - The OWNER always receives every permission in the catalog.
 *   - Roles with no permissions yet receive their full catalog defaults
 *     (this is how freshly added roles like ACCOUNTANT pick up their scope).
 *   - Roles that already hold permissions (e.g. HEADTEACHER) only receive
 *     defaults from modules that are brand-new to the database. Owner-adjusted
 *     permissions on pre-existing modules therefore survive restarts and
 *     re-seeding, while new phase modules (e.g. `finance`) are still wired up.
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

  // Modules that already have at least one permission assigned to any role.
  const assignedPermissions = await prisma.rolePermission.findMany({
    select: { permissionId: true },
  })
  const assignedPermissionIds = new Set(assignedPermissions.map((row) => row.permissionId))
  const modulesInUse = new Set<string>()
  for (const permission of PERMISSIONS) {
    const id = permissionIds.get(permission.key)
    if (id && assignedPermissionIds.has(id)) modulesInUse.add(permission.module)
  }

  for (const role of ROLE_DEFINITIONS) {
    const roleId = roleIds.get(role.name)
    if (!roleId) continue

    const existingRows = await prisma.rolePermission.findMany({
      where: { roleId },
      include: { permission: { select: { key: true } } },
    })
    const existingKeys = new Set(existingRows.map((row) => row.permission.key))
    const defaults = role.name === OWNER_ROLE ? PERMISSIONS.map((p) => p.key) : role.permissions

    const missing = defaults.filter((key) => {
      if (existingKeys.has(key)) return false
      const definition = permissionByKey(key)
      if (!definition) return false
      if (existingKeys.size === 0) return true
      if (role.name === OWNER_ROLE) return true
      return !modulesInUse.has(definition.module)
    })
    if (missing.length === 0) continue

    const assignments = missing
      .map((key) => permissionIds.get(key))
      .filter((permissionId): permissionId is string => Boolean(permissionId))
      .map((permissionId) => ({ roleId, permissionId }))
    if (assignments.length > 0) {
      await prisma.rolePermission.createMany({ data: assignments })
    }
  }
}