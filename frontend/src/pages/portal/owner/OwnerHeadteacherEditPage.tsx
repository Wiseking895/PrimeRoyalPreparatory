import { useCallback, useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { ArrowLeft, Lock, Save, ShieldCheck, UserCog } from 'lucide-react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { PageHeader } from '@/components/dashboard/PageHeader'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Avatar } from '@/components/dashboard/Avatar'
import { StatusBadge, Badge } from '@/components/dashboard/Badge'
import { Switch } from '@/components/dashboard/Switch'
import { TextField, SelectField, TextAreaField } from '@/components/dashboard/Field'
import { Spinner, TableSkeleton } from '@/components/dashboard/Loaders'
import { ErrorState, EmptyState } from '@/components/dashboard/States'
import { ConfirmDialog } from '@/components/dashboard/ConfirmDialog'
import { useToast } from '@/components/dashboard/Toast'
import { api } from '@/lib/api'
import type { GroupedPermission, PublicUser } from '@/types/portal'
import { OWNER_ONLY_PERMISSIONS } from '@prps/shared'

const SENSITIVE_PERMISSIONS = new Set(['staff.remove_role', 'staff.manage', 'academic.manage'])

interface SensitiveToggle {
  key: string
  label: string
  turningOn: boolean
}

export function OwnerHeadteacherEditPage() {
  const { id = '' } = useParams()
  const [searchParams] = useSearchParams()
  const { push } = useToast()

  const [headteacher, setHeadteacher] = useState<PublicUser | null>(null)
  const [groups, setGroups] = useState<GroupedPermission[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Profile form
  const [profile, setProfile] = useState({ firstName: '', lastName: '', email: '', phone: '', address: '' })
  const [profileLoaded, setProfileLoaded] = useState(false)
  const [profileSaving, setProfileSaving] = useState(false)

  // Permissions
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [savingPermissions, setSavingPermissions] = useState(false)
  const [sensitive, setSensitive] = useState<SensitiveToggle | null>(null)
  const [statusLoading, setStatusLoading] = useState(false)

  const [activeTab, setActiveTab] = useState<'profile' | 'permissions'>(() =>
    searchParams.get('tab') === 'permissions' ? 'permissions' : 'profile',
  )

  const load = useCallback(async () => {
    setError(null)
    try {
      const [headteacherData, groupsData] = await Promise.all([api.getHeadteacher(id), api.listPermissions()])
      setHeadteacher(headteacherData)
      setGroups(groupsData)
      setSelected(new Set(headteacherData.permissions))
      if (!profileLoaded) {
        const names = headteacherData.fullName.trim().split(/\s+/)
        setProfile({
          firstName: names[0] ?? '',
          lastName: names.slice(1).join(' ') ?? '',
          email: headteacherData.email,
          phone: headteacherData.phone ?? '',
          address: '',
        })
        setProfileLoaded(true)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load the Headteacher account.')
    }
  }, [id, profileLoaded])

  useEffect(() => {
    void load()
  }, [load])

  const availablePermissions = useMemo(() => {
    const flat = groups?.flatMap((group) => group.permissions) ?? []
    return new Map(flat.map((permission) => [permission.key, permission]))
  }, [groups])

  const togglePermission = (key: string, turningOn: boolean) => {
    const definition = availablePermissions.get(key)
    if (turningOn && definition && SENSITIVE_PERMISSIONS.has(key)) {
      setSensitive({ key, label: definition.label, turningOn: true })
      return
    }
    applyToggle(key, turningOn)
  }

  const applyToggle = (key: string, turningOn: boolean) => {
    setSelected((current) => {
      const next = new Set(current)
      if (turningOn) next.add(key)
      else next.delete(key)
      return next
    })
  }

  const handleSavePermissions = async () => {
    setSavingPermissions(true)
    try {
      const updated = await api.setHeadteacherPermissions(id, Array.from(selected))
      setHeadteacher(updated)
      setSelected(new Set(updated.permissions))
      push('success', 'Headteacher permissions updated.')
    } catch (err) {
      push('error', err instanceof Error ? err.message : 'Could not update permissions.')
    } finally {
      setSavingPermissions(false)
    }
  }

  const handleProfileSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setProfileSaving(true)
    try {
      const updated = await api.updateHeadteacher(id, {
        firstName: profile.firstName,
        lastName: profile.lastName,
        email: profile.email,
        phone: profile.phone || undefined,
        address: profile.address || undefined,
      })
      setHeadteacher(updated)
      push('success', 'Headteacher profile updated.')
    } catch (err) {
      push('error', err instanceof Error ? err.message : 'Could not update the profile.')
    } finally {
      setProfileSaving(false)
    }
  }

  const handleStatusToggle = async (status: 'ACTIVE' | 'INACTIVE') => {
    setStatusLoading(true)
    try {
      const updated = await api.setHeadteacherStatus(id, status)
      setHeadteacher(updated)
      push('success', status === 'ACTIVE' ? 'Headteacher activated.' : 'Headteacher deactivated.')
    } catch (err) {
      push('error', err instanceof Error ? err.message : 'Could not update the account.')
    } finally {
      setStatusLoading(false)
    }
  }

  if (error) {
    return (
      <div className="space-y-6">
        <BackLink />
        <ErrorState message={error} />
      </div>
    )
  }

  if (headteacher === null || groups === null) {
    return (
      <div className="space-y-6">
        <BackLink />
        <TableSkeleton rows={4} />
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <BackLink />
      <PageHeader
        eyebrow="Owner · Headteacher"
        title={headteacher.fullName}
        description={`Staff ID ${headteacher.staffId ?? '—'} · ${headteacher.email}`}
        actions={
          <>
            <StatusBadge status={headteacher.status} />
            {headteacher.status === 'ACTIVE' ? (
              <Button variant="cream" onClick={() => void handleStatusToggle('INACTIVE')} disabled={statusLoading}>
                {statusLoading ? <Spinner className="h-4 w-4" /> : null}
                Deactivate
              </Button>
            ) : (
              <Button variant="cream" onClick={() => void handleStatusToggle('ACTIVE')} disabled={statusLoading}>
                {statusLoading ? <Spinner className="h-4 w-4" /> : null}
                Activate
              </Button>
            )}
          </>
        }
      />

      <Card className="p-5">
        <div className="flex items-center gap-4">
          <Avatar name={headteacher.fullName} size="lg" />
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="royal">
                <UserCog className="h-3.5 w-3.5" aria-hidden="true" />
                HEADTEACHER
              </Badge>
              <Badge tone="magenta">{headteacher.permissions.length} permissions assigned</Badge>
            </div>
            <p className="mt-2 max-w-2xl text-sm text-ink-500">
              The Headteacher is the overall operational administrator. Permissions below are the
              authority you delegate from the OWNER account.
            </p>
          </div>
        </div>
      </Card>

      <div className="flex gap-2 border-b border-cream-300">
        {(
          [
            { key: 'profile', label: 'Profile' },
            { key: 'permissions', label: 'Role & Permissions' },
          ] as const
        ).map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            className={[
              'rounded-t-lg border-b-2 px-4 py-2.5 text-sm font-semibold transition-colors',
              activeTab === tab.key
                ? 'border-magenta-500 text-magenta-600'
                : 'border-transparent text-ink-500 hover:text-ink-900',
            ].join(' ')}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'profile' ? (
        <form onSubmit={handleProfileSubmit} noValidate className="grid gap-4 sm:grid-cols-2">
          <TextField
            label="First name"
            name="firstName"
            value={profile.firstName}
            onChange={(event) =>
              setProfile((current) => ({ ...current, firstName: event.target.value }))
            }
            required
          />
          <TextField
            label="Last name"
            name="lastName"
            value={profile.lastName}
            onChange={(event) =>
              setProfile((current) => ({ ...current, lastName: event.target.value }))
            }
            required
          />
          <div className="sm:col-span-2">
            <TextField
              label="Email"
              name="email"
              type="email"
              value={profile.email}
              onChange={(event) => setProfile((current) => ({ ...current, email: event.target.value }))}
              required
            />
          </div>
          <TextField
            label="Phone"
            name="phone"
            value={profile.phone}
            onChange={(event) => setProfile((current) => ({ ...current, phone: event.target.value }))}
          />
          <SelectField
            label="Account status"
            name="status"
            value={headteacher.status}
            options={[
              { value: 'ACTIVE', label: 'Active' },
              { value: 'INACTIVE', label: 'Inactive' },
            ]}
            onChange={() => undefined}
          />
          <div className="sm:col-span-2">
            <TextAreaField
              label="Address"
              name="address"
              value={profile.address}
              onChange={(event) => setProfile((current) => ({ ...current, address: event.target.value }))}
            />
          </div>
          <div className="flex justify-end sm:col-span-2">
            <Button type="submit" disabled={profileSaving}>
              {profileSaving ? <Spinner className="h-4 w-4" /> : <Save className="h-4 w-4" aria-hidden="true" />}
              Save changes
            </Button>
          </div>
        </form>
      ) : (
        <div className="space-y-6">
          {/* Hierarchy note */}
          <Card className="p-5">
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-royal-600/10 text-royal-600">
                <ShieldCheck className="h-5 w-5" aria-hidden="true" />
              </span>
              <div>
                <p className="text-sm font-bold text-ink-900">Delegated authority</p>
                <p className="mt-1 text-sm leading-relaxed text-ink-500">
                  The OWNER holds every permission. The Headteacher exercises only the subset you
                  assign here — it can never exceed your own authority, and owner-only system
                  permissions can never be granted.
                </p>
              </div>
            </div>
          </Card>

          {groups.length === 0 ? (
            <EmptyState title="No permissions available." />
          ) : (
            groups.map((group) => (
              <Card key={group.module} className="p-6">
                <h2 className="text-sm font-bold uppercase tracking-wider text-ink-500">
                  {group.moduleLabel}
                </h2>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  {group.permissions.map((permission) => {
                    const isOwnerOnly = (OWNER_ONLY_PERMISSIONS as readonly string[]).includes(
                      permission.key,
                    )
                    const checked = selected.has(permission.key)
                    if (isOwnerOnly) {
                      return (
                        <div
                          key={permission.key}
                          className="flex items-start gap-3 rounded-xl border border-cream-200 bg-cream-50 p-3.5 opacity-70"
                        >
                          <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-cream-200 text-ink-500">
                            <Lock className="h-3.5 w-3.5" aria-hidden="true" />
                          </span>
                          <span className="flex-1">
                            <span className="block text-sm font-semibold text-ink-900">{permission.label}</span>
                            <span className="mt-0.5 block text-xs text-ink-500">Owner only — not grantable</span>
                          </span>
                        </div>
                      )
                    }
                    return (
                      <Switch
                        key={permission.key}
                        checked={checked}
                        onChange={(next) => togglePermission(permission.key, next)}
                        label={permission.label}
                        description={permission.description}
                        tone={checked && SENSITIVE_PERMISSIONS.has(permission.key) ? 'danger' : 'default'}
                      />
                    )
                  })}
                </div>
              </Card>
            ))
          )}

          <div className="flex items-center justify-end gap-3 border-t border-cream-200 pt-5">
            <p className="mr-auto text-sm text-ink-500">
              {selected.size} permission{selected.size === 1 ? '' : 's'} selected
            </p>
            <Button onClick={() => void handleSavePermissions()} disabled={savingPermissions}>
              {savingPermissions ? (
                <Spinner className="h-4 w-4" />
              ) : (
                <Save className="h-4 w-4" aria-hidden="true" />
              )}
              Save permissions
            </Button>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={sensitive !== null}
        title="Grant a sensitive permission"
        message={
          <>
            You are about to grant <strong>{sensitive?.label}</strong> to the Headteacher. This
            permission carries significant authority within the school.
          </>
        }
        confirmLabel="Grant permission"
        onConfirm={() => {
          if (sensitive) applyToggle(sensitive.key, sensitive.turningOn)
          setSensitive(null)
        }}
        onCancel={() => setSensitive(null)}
      />
    </div>
  )
}

function BackLink() {
  return (
    <Link
      to="/owner/headteacher"
      className="inline-flex items-center gap-2 text-sm font-semibold text-ink-500 transition-colors hover:text-magenta-600"
    >
      <ArrowLeft className="h-4 w-4" aria-hidden="true" />
      All Headteacher accounts
    </Link>
  )
}