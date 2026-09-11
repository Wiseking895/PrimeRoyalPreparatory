import { PrismaClient } from '@prisma/client'
import { SCHOOL } from '../src/config/constants'
import { DEFAULT_CLASSES } from '../src/config/constants'
import { OWNER_ROLE, PERMISSIONS, ROLE_DEFINITIONS, permissionByKey } from '../src/rbac/catalog'

const prisma = new PrismaClient()

/**
 * Upserts the school identity profile, roles, permissions and default role →
 * permission assignments from the backend RBAC catalog.
 *
 * The Owner account is intentionally NOT seeded: the first Owner is always
 * created through the secure initial setup flow (POST /api/setup/owner) so no
 * plaintext/known credential can ever exist in the database seed.
 */
async function main(): Promise<void> {
  const school = await prisma.schoolProfile.upsert({
    where: { id: 'prps-school-profile' },
    update: {
      name: SCHOOL.name,
      abbreviation: SCHOOL.abbreviation,
      motto: SCHOOL.motto,
      tagline: SCHOOL.tagline,
    },
    create: {
      id: 'prps-school-profile',
      name: SCHOOL.name,
      abbreviation: SCHOOL.abbreviation,
      motto: SCHOOL.motto,
      tagline: SCHOOL.tagline,
    },
  })
  console.log(`[seed] School profile ready: ${school.name} (${school.abbreviation})`)

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
  console.log(`[seed] Permissions ready: ${PERMISSIONS.length}`)

  const roleIds = new Map<string, string>()
  for (const role of ROLE_DEFINITIONS) {
    const record = await prisma.role.upsert({
      where: { name: role.name },
      update: { description: role.description },
      create: {
        name: role.name,
        description: role.description,
        isSystem: true,
      },
    })
    roleIds.set(role.name, record.id)
  }
  console.log(`[seed] Roles ready: ${ROLE_DEFINITIONS.length}`)

  // Default role → permission assignments. Add-only sync so Owner-adjusted
  // permissions on pre-existing modules survive re-seeding:
  //   - roles with no permissions yet receive their full catalog defaults,
  //   - roles that already hold permissions receive defaults for modules
  //     where the role currently has zero permissions assigned.

  for (const role of ROLE_DEFINITIONS) {
    const roleId = roleIds.get(role.name)
    if (!roleId) continue
    const existingRows = await prisma.rolePermission.findMany({
      where: { roleId },
      include: { permission: { select: { key: true, module: true } } },
    })
    const existingKeys = new Set(existingRows.map((row) => row.permission.key))
    const defaults = role.name === OWNER_ROLE ? PERMISSIONS.map((p) => p.key) : role.permissions
    const missing = defaults.filter((key) => {
      if (existingKeys.has(key)) return false
      const definition = permissionByKey(key)
      if (!definition) return false
      if (existingKeys.size === 0) return true
      if (role.name === OWNER_ROLE) return true
      const roleHasModule = existingRows.some((row) => row.permission.module === definition.module)
      return !roleHasModule
    })
    if (missing.length === 0) continue
    await prisma.rolePermission.createMany({
      data: missing
        .map((key) => permissionIds.get(key))
        .filter((permissionId): permissionId is string => Boolean(permissionId))
        .map((permissionId) => ({ roleId, permissionId })),
    })
  }
  console.log('[seed] Default role permissions ready.')

  // Default class levels. These are the starting point only — the school
  // manages its own class structure through the class management API.
  for (const klass of DEFAULT_CLASSES) {
    await prisma.schoolClass.upsert({
      where: { key: klass.key },
      update: {
        name: klass.name,
        description: klass.description,
        sortOrder: klass.sortOrder,
      },
      create: {
        key: klass.key,
        name: klass.name,
        description: klass.description,
        sortOrder: klass.sortOrder,
      },
    })
  }
  console.log(`[seed] Default classes ready: ${DEFAULT_CLASSES.length}`)
}

main()
  .catch((error) => {
    console.error('[seed] Failed to seed database.')
    console.error(error)
    process.exitCode = 1
  })
  .finally(() => {
    void prisma.$disconnect()
  })