import { useCallback, useEffect, useState } from 'react'
import { ShieldCheck, UsersRound } from 'lucide-react'
import { useAuth } from '@/auth/AuthContext'
import { PageHeader } from '@/components/dashboard/PageHeader'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/dashboard/Badge'
import { TableSkeleton } from '@/components/dashboard/Loaders'
import { EmptyState, ErrorState } from '@/components/dashboard/States'
import { api } from '@/lib/api'
import type { GroupedPermission, RoleDefinition } from '@/types/portal'

export function RolesPage() {
  const { isOwner, user } = useAuth()
  const [roles, setRoles] = useState<RoleDefinition[] | null>(null)
  const [groups, setGroups] = useState<GroupedPermission[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setError(null)
    try {
      const [rolesData, groupsData] = await Promise.all([api.listRoles(), api.listPermissions()])
      setRoles(rolesData)
      setGroups(groupsData)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load roles and permissions.')
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  if (error) {
    return (
      <div className="space-y-6">
        <PageHeader
          eyebrow="Access Control"
          title="Roles & Permissions"
          description="The roles available to this account and the permission catalog they draw from."
        />
        <ErrorState message={error} onRetry={() => void load()} />
      </div>
    )
  }

  if (roles === null || groups === null) {
    return (
      <div className="space-y-6">
        <PageHeader
          eyebrow="Access Control"
          title="Roles & Permissions"
          description="The roles available to this account and the permission catalog they draw from."
        />
        <TableSkeleton rows={6} />
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Access Control"
        title="Roles & Permissions"
        description={
          isOwner
            ? 'Every role defined for the school platform and the full permission catalog. Owner-only system permissions can never be delegated.'
            : `The staff roles you may assign and the permissions your account currently holds (${user?.permissions.length ?? 0} total).`
        }
      />

      {/* Roles */}
      <section aria-label="Roles">
        <div className="mb-4 flex items-center gap-2">
          <UsersRound className="h-5 w-5 text-royal-500" aria-hidden="true" />
          <h2 className="text-sm font-bold uppercase tracking-wider text-ink-500">Roles</h2>
        </div>
        {roles.length === 0 ? (
          <EmptyState title="No roles are available to this account." />
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {roles.map((role) => (
              <Card key={role.name} className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-royal-600/10 text-royal-600">
                      <ShieldCheck className="h-5 w-5" aria-hidden="true" />
                    </span>
                    <div>
                      <p className="text-sm font-bold text-ink-900">{role.label}</p>
                      <p className="text-xs text-ink-500">{role.name}</p>
                    </div>
                  </div>
                  <Badge tone={isOwner && role.name === 'OWNER' ? 'gold' : 'royal'}>
                    {role.permissions.length} permission{role.permissions.length === 1 ? '' : 's'}
                  </Badge>
                </div>
                <p className="mt-3 text-sm leading-relaxed text-ink-500">{role.description}</p>
                {role.permissions.length > 0 ? (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {role.permissions.map((permission) => (
                      <span
                        key={permission}
                        className="rounded-full bg-cream-100 px-2.5 py-1 text-xs font-medium text-ink-700 ring-1 ring-inset ring-cream-300"
                      >
                        {permission}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="mt-3 text-xs text-ink-500">No default permissions. Assigned per account in later phases.</p>
                )}
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* Permission catalog */}
      <section aria-label="Permission catalog">
        <div className="mb-4 flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-royal-500" aria-hidden="true" />
          <h2 className="text-sm font-bold uppercase tracking-wider text-ink-500">Permission Catalog</h2>
        </div>
        {groups.length === 0 ? (
          <EmptyState title="No permissions are visible to this account." />
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {groups.map((group) => (
              <Card key={group.module} className="p-5">
                <h3 className="text-sm font-bold text-ink-900">{group.moduleLabel}</h3>
                <ul className="mt-3 space-y-2">
                  {group.permissions.map((permission) => (
                    <li key={permission.key} className="flex items-start gap-2">
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-magenta-500" aria-hidden="true" />
                      <span className="min-w-0">
                        <span className="block text-sm font-semibold text-ink-900">{permission.label}</span>
                        <span className="block truncate text-xs text-ink-500">{permission.key}</span>
                        {permission.description ? (
                          <span className="mt-0.5 block text-xs text-ink-500">{permission.description}</span>
                        ) : null}
                      </span>
                    </li>
                  ))}
                </ul>
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
