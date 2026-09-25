import { useCallback, useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import {
  ArrowLeft,
  Calendar,
  KeyRound,
  ChevronRight,
  Mail,
  MapPin,
  Pencil,
  Phone,
  RefreshCw,
  ShieldCheck,
  Trash2,
  UserRound,
} from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import { OWNER_ROLE, ASSIGNABLE_STAFF_ROLES, STAFF_POSITIONS, staffPositionByKey } from '@/auth/roles'
import { useAuth } from '@/auth/AuthContext'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Avatar } from '@/components/dashboard/Avatar'
import { StatusBadge, Badge } from '@/components/dashboard/Badge'
import { InvitationBadge } from '@/components/dashboard/InvitationBadge'
import { ConfirmDialog } from '@/components/dashboard/ConfirmDialog'
import { TextField, SelectField, TextAreaField } from '@/components/dashboard/Field'
import { Spinner, CardSkeleton } from '@/components/dashboard/Loaders'
import { ErrorState } from '@/components/dashboard/States'
import { useToast } from '@/components/dashboard/Toast'
import { api } from '@/lib/api'
import { invitationFeedback } from '@/lib/invitation'
import { formatDate } from '@/lib/date'
import type { InvitationResult, RoleDefinition, StaffView } from '@/types/portal'
import { cn } from '@/lib/cn'

interface EditForm {
  firstName: string
  lastName: string
  email: string
  phone: string
  address: string
  position: string
  responsibilities: string
}

export function StaffProfilePage() {
  const { id } = useParams<{ id: string }>()
  const { push } = useToast()
  const { user, hasPermission } = useAuth()

  const basePath = user?.roles.includes(OWNER_ROLE) ? '/owner' : '/headteacher'

  const [staff, setStaff] = useState<StaffView | null>(null)
  const [roles, setRoles] = useState<RoleDefinition[]>([])
  const [error, setError] = useState<string | null>(null)

  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState<EditForm | null>(null)
  const [formErrors, setFormErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)

  const [roleValue, setRoleValue] = useState('')
  const [assignLoading, setAssignLoading] = useState(false)
  const [busyAction, setBusyAction] = useState<string | null>(null)

  const [confirmStatus, setConfirmStatus] = useState<'ACTIVE' | 'INACTIVE' | null>(null)
  const [resendOpen, setResendOpen] = useState(false)
  const [resending, setResending] = useState(false)
  const [lastInvitation, setLastInvitation] = useState<InvitationResult | null>(null)

  const can = {
    update: hasPermission('staff.update'),
    assignRole: hasPermission('staff.assign_role'),
    removeRole: hasPermission('staff.remove_role'),
  }

  const load = useCallback(async () => {
    if (!id) return
    setError(null)
    try {
      const [staffData, roleDefinitions] = await Promise.all([
        api.getStaff(id),
        api.listRoles(),
      ])
      setStaff(staffData)
      setRoles(roleDefinitions.filter((role) => ASSIGNABLE_STAFF_ROLES.includes(role.name)))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load the staff profile.')
    }
  }, [id])

  useEffect(() => {
    void load()
  }, [load])

  const startEditing = () => {
    if (!staff) return
    const names = staff.fullName.trim().split(/\s+/)
    setForm({
      firstName: names[0] ?? '',
      lastName: names.slice(1).join(' '),
      email: staff.email,
      phone: staff.phone ?? '',
      address: staff.address ?? '',
      position: staff.position ?? '',
      responsibilities: staff.responsibilities ?? '',
    })
    setFormErrors({})
    setEditing(true)
  }

  const setFormField = (field: keyof EditForm, value: string) => {
    setForm((current) => (current ? { ...current, [field]: value } : current))
    setFormErrors((current) => {
      if (!current[field]) return current
      const next = { ...current }
      delete next[field]
      return next
    })
  }

  const handleEdit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!staff || !form) return
    const errors: Record<string, string> = {}
    if (form.firstName.trim().length < 2) errors.firstName = 'First name must be at least 2 characters.'
    if (form.lastName.trim().length < 2) errors.lastName = 'Last name must be at least 2 characters.'
    if (!/^\S+@\S+\.\S+$/.test(form.email.trim())) errors.email = 'Enter a valid email address.'
    if (!form.position) errors.position = 'Select a staff position.'
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors)
      return
    }

    setSaving(true)
    try {
      const updated = await api.updateStaff(staff.id, {
        firstName: form.firstName,
        lastName: form.lastName,
        email: form.email,
        phone: form.phone || undefined,
        address: form.address || undefined,
        position: form.position,
        responsibilities: form.responsibilities || undefined,
      })
      setStaff(updated)
      setEditing(false)
      push('success', 'Staff profile updated.')
    } catch (err) {
      const apiError = err as { fieldErrors?: Record<string, string> }
      if (apiError.fieldErrors && Object.keys(apiError.fieldErrors).length > 0) {
        setFormErrors(apiError.fieldErrors)
      } else {
        push('error', err instanceof Error ? err.message : 'Could not update the profile.')
      }
    } finally {
      setSaving(false)
    }
  }

  const handleAssignRole = async () => {
    if (!staff || !roleValue) return
    setAssignLoading(true)
    try {
      const updated = await api.assignRole(staff.id, roleValue)
      setStaff(updated)
      setRoleValue('')
      push('success', `${staff.fullName} assigned the ${roleValue} role.`)
    } catch (err) {
      push('error', err instanceof Error ? err.message : 'Could not assign the role.')
    } finally {
      setAssignLoading(false)
    }
  }

  const handleRemoveRole = async () => {
    if (!staff) return
    setBusyAction('remove')
    try {
      const updated = await api.removeRole(staff.id)
      setStaff(updated)
      push('success', `${staff.fullName} no longer has a staff role.`)
    } catch (err) {
      push('error', err instanceof Error ? err.message : 'Could not remove the role.')
    } finally {
      setBusyAction(null)
    }
  }

  const handleToggleStatus = async () => {
    if (!staff || !confirmStatus) return
    setBusyAction('status')
    try {
      const updated = await api.setStaffStatus(staff.id, confirmStatus)
      setStaff(updated)
      push('success', confirmStatus === 'ACTIVE' ? `${staff.fullName} activated.` : `${staff.fullName} deactivated.`)
    } catch (err) {
      push('error', err instanceof Error ? err.message : 'Could not update the account.')
    } finally {
      setBusyAction(null)
      setConfirmStatus(null)
    }
  }

  const handleResend = async () => {
    if (!staff) return
    setResending(true)
    try {
      const result = await api.resendStaffInvitation(staff.id)
      setLastInvitation(result.invitation)
      setResendOpen(false)
      const feedback = invitationFeedback(result.invitation, 'resend', 'staff')
      push(feedback.tone, feedback.message)
    } catch (err) {
      push('error', err instanceof Error ? err.message : 'Could not resend the invitation.')
    } finally {
      setResending(false)
    }
  }

  const nextStatus: 'ACTIVE' | 'INACTIVE' = staff?.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE'

  if (error) {
    return (
      <div className="space-y-6 rounded-3xl bg-royal-900 p-5 sm:p-7 lg:p-8">
        <Button variant="outline" size="sm" to={`${basePath}/staff`}>
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Back to staff
        </Button>
        <ErrorState message={error} onRetry={() => void load()} />
      </div>
    )
  }

  if (!staff) {
    return (
      <div className="space-y-6 rounded-3xl bg-royal-900 p-5 sm:p-7 lg:p-8">
        <CardSkeleton />
        <CardSkeleton />
        <CardSkeleton />
      </div>
    )
  }

  const assignableOptions = roles.map((role) => ({ value: role.name, label: role.label }))
  const isSelf = staff.id === user?.id

  return (
    <div className="space-y-6 rounded-3xl bg-royal-900 p-5 sm:p-7 lg:p-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs font-semibold text-cream-200/70">
            <Link to={`${basePath}/staff`} className="transition-colors hover:text-white">
              Staff
            </Link>
            <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
            <span className="text-gold-300">Profile</span>
          </nav>
          <h1 className="mt-1.5 text-2xl font-extrabold tracking-tight text-white sm:text-3xl">
            Staff Profile
          </h1>
          <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-cream-200/75">
            Account details, access and management for this staff member.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" to={`${basePath}/staff`}>
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Back to staff
          </Button>
          {can.update && !isSelf ? (
            <Button variant="cream" size="sm" onClick={() => (editing ? setEditing(false) : startEditing())}>
              <Pencil className="h-4 w-4" aria-hidden="true" />
              {editing ? 'Cancel' : 'Edit'}
            </Button>
          ) : null}
        </div>
      </div>

      {/* Identity */}
      <Card className="p-6 sm:p-7">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <Avatar name={staff.fullName} size="xl" className="ring-4 ring-cream-200" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-xl font-extrabold tracking-tight text-royal-800">{staff.fullName}</p>
              <StatusBadge status={staff.status} />
              {staff.mustChangePassword ? <Badge tone="amber">Awaiting password change</Badge> : null}
            </div>
            <p className="mt-0.5 text-sm text-ink-500">{staff.staffId} · {staff.email}</p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-gold-400/20 px-2.5 py-1 text-xs font-bold text-gold-700 ring-1 ring-inset ring-gold-500/30">
                {staff.category?.replace('_', ' ') ?? 'Staff'}
              </span>
              <span className="rounded-full bg-cream-100 px-2.5 py-1 text-xs font-semibold text-ink-700 ring-1 ring-inset ring-cream-300">
                {staffPositionByKey(staff.position)?.label ?? staff.position ?? 'No position'}
              </span>
              {staff.roles.map((role) => (
                <span
                  key={role}
                  className="rounded-full bg-cream-100 px-2.5 py-1 text-xs font-semibold text-ink-700 ring-1 ring-inset ring-cream-300"
                >
                  {role}
                </span>
              ))}
              {lastInvitation ? <InvitationBadge invitation={lastInvitation} /> : null}
            </div>
          </div>
        </div>
      </Card>

      {editing && form ? (
        <Card className="p-6">
          <h2 className="text-sm font-bold uppercase tracking-wider text-royal-800">Edit profile</h2>
          <form onSubmit={handleEdit} noValidate className="mt-4 grid gap-4 sm:grid-cols-2">
            <TextField
              label="First name"
              name="firstName"
              value={form.firstName}
              onChange={(event) => setFormField('firstName', event.target.value)}
              error={formErrors.firstName}
              required
            />
            <TextField
              label="Last name"
              name="lastName"
              value={form.lastName}
              onChange={(event) => setFormField('lastName', event.target.value)}
              error={formErrors.lastName}
              required
            />
            <div className="sm:col-span-2">
              <TextField
                label="Email"
                name="email"
                type="email"
                value={form.email}
                onChange={(event) => setFormField('email', event.target.value)}
                error={formErrors.email}
                required
              />
            </div>
            <TextField
              label="Phone"
              name="phone"
              value={form.phone}
              onChange={(event) => setFormField('phone', event.target.value)}
              error={formErrors.phone}
            />
            <SelectField
              label="Position"
              name="position"
              value={form.position}
              onChange={(event) => setFormField('position', event.target.value)}
              options={STAFF_POSITIONS.map((position) => ({ value: position.key, label: position.label }))}
              placeholder="Select a position"
              error={formErrors.position}
              hint="Changing the position updates the staff category and system role."
              required
            />
            <div className="sm:col-span-2">
              <TextField
                label="Address"
                name="address"
                value={form.address}
                onChange={(event) => setFormField('address', event.target.value)}
                error={formErrors.address}
              />
            </div>
            <div className="sm:col-span-2">
              <TextAreaField
                label="Responsibilities"
                name="responsibilities"
                value={form.responsibilities}
                onChange={(event) => setFormField('responsibilities', event.target.value)}
              />
            </div>
            <div className="flex justify-end gap-2 sm:col-span-2">
              <Button variant="outline" type="button" onClick={() => setEditing(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="secondary" disabled={saving}>
                {saving ? <Spinner className="h-4 w-4" /> : null}
                Save changes
              </Button>
            </div>
          </form>
        </Card>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Details */}
          <Card className="p-6">
            <h2 className="text-sm font-bold uppercase tracking-wider text-royal-800">Profile details</h2>
            <dl className="mt-4 grid gap-x-6 gap-y-4 sm:grid-cols-2">
              {renderDetail(UserRound, 'Position', staffPositionByKey(staff.position)?.label ?? staff.position ?? '—')}
              {renderDetail(ShieldCheck, 'Category', staff.category?.replace('_', ' ') ?? '—')}
              {renderDetail(Mail, 'Email', staff.email)}
              {renderDetail(Phone, 'Phone', staff.phone ?? '—')}
              {renderDetail(MapPin, 'Address', staff.address ?? '—')}
              {renderDetail(Calendar, 'Date joined', staff.dateJoined ? formatDate(staff.dateJoined) : '—')}
              {renderDetail(Calendar, 'Last login', staff.lastLoginAt ? formatDate(staff.lastLoginAt) : 'Never signed in')}
              {renderDetail(KeyRound, 'Staff ID', staff.staffId ?? '—')}
            </dl>
            {staff.responsibilities ? (
              <p className="mt-4 border-t border-cream-200 pt-4 text-sm leading-relaxed text-ink-700">
                <span className="font-semibold text-ink-900">Responsibilities:</span> {staff.responsibilities}
              </p>
            ) : null}
          </Card>

          {/* Permissions */}
          <Card className="p-6">
            <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-royal-800">
              <ShieldCheck className="h-4 w-4" aria-hidden="true" />
              Permissions via role
            </h2>
            <div className="mt-4 flex flex-wrap gap-1.5">
              {staff.permissions.length > 0 ? (
                staff.permissions.map((permission) => (
                  <span
                    key={permission}
                    className="rounded-full bg-cream-100 px-2.5 py-1 text-xs font-medium text-ink-700 ring-1 ring-inset ring-cream-300"
                  >
                    {permission}
                  </span>
                ))
              ) : (
                <span className="text-sm text-ink-500">This account has no assigned permissions.</span>
              )}
            </div>
            <p className="mt-4 border-t border-cream-200 pt-4 text-xs leading-relaxed text-ink-500">
              Permissions are derived from the assigned system role. The role follows the staff position.
            </p>
          </Card>
        </div>
      )}

      {/* Management actions */}
      <Card className="p-6">
        <h2 className="text-sm font-bold uppercase tracking-wider text-royal-800">Account management</h2>
        <div className="mt-4 flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-2">
            {can.assignRole ? (
              <>
                <SelectField
                  label=""
                  name="assignRole"
                  value={roleValue}
                  onChange={(event) => setRoleValue(event.target.value)}
                  options={assignableOptions}
                  placeholder="Assign a staff role"
                  className="min-w-44 flex-1"
                  aria-label="Assign a staff role"
                />
                <button
                  type="button"
                  disabled={!roleValue || assignLoading}
                  onClick={() => void handleAssignRole()}
                  className="inline-flex items-center gap-2 rounded-full bg-royal-700 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-royal-800 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {assignLoading ? <Spinner className="h-4 w-4" /> : <KeyRound className="h-4 w-4" aria-hidden="true" />}
                  Assign role
                </button>
              </>
            ) : (
              <span className="flex items-center gap-2 text-sm text-ink-500">
                <KeyRound className="h-4 w-4" aria-hidden="true" />
                Role assignment requires the assign-role permission.
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2 border-t border-cream-200 pt-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setResendOpen(true)}
              disabled={resending}
            >
              <RefreshCw className={cn('h-4 w-4', resending ? 'animate-spin' : '')} aria-hidden="true" />
              Resend invitation
            </Button>

            {can.removeRole && staff.roles.length > 0 ? (
              <button
                type="button"
                onClick={() => void handleRemoveRole()}
                disabled={busyAction === 'remove'}
                className="inline-flex items-center gap-2 rounded-full border border-red-200 px-4 py-2 text-sm font-semibold text-red-700 transition-colors hover:bg-red-50 disabled:opacity-50"
              >
                {busyAction === 'remove' ? (
                  <Spinner className="h-4 w-4" />
                ) : (
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                )}
                Remove role
              </button>
            ) : null}

            {can.update && !isSelf ? (
              <button
                type="button"
                onClick={() => setConfirmStatus(nextStatus)}
                disabled={busyAction === 'status'}
                className={cn(
                  'inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition-colors disabled:opacity-50',
                  staff.status === 'ACTIVE'
                    ? 'border border-red-200 text-red-700 hover:bg-red-50'
                    : 'bg-emerald-600 text-white hover:bg-emerald-700',
                )}
              >
                {busyAction === 'status' ? <Spinner className="h-4 w-4" /> : <UserRound className="h-4 w-4" aria-hidden="true" />}
                {staff.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}
              </button>
            ) : null}
          </div>
        </div>
      </Card>

      {/* Status confirm */}
      <ConfirmDialog
        open={confirmStatus !== null}
        title={nextStatus === 'ACTIVE' ? 'Activate account' : 'Deactivate account'}
        message={
          nextStatus === 'ACTIVE'
            ? `Activating ${staff.fullName} restores their ability to sign in to the PRPS staff portal.`
            : `Deactivating ${staff.fullName} immediately prevents them from signing in to the PRPS staff portal.`
        }
        confirmLabel={nextStatus === 'ACTIVE' ? 'Activate' : 'Deactivate'}
        loading={busyAction === 'status'}
        onConfirm={() => void handleToggleStatus()}
        onCancel={() => setConfirmStatus(null)}
      />

      {/* Resend invitation confirm */}
      <ConfirmDialog
        open={resendOpen}
        title="Resend invitation"
        message={
          <>
            A new temporary password will be generated for <strong>{staff.fullName}</strong> and the
            invitation email re-sent. Any previously delivered temporary password will stop working.
            No duplicate account is created.
          </>
        }
        confirmLabel="Resend invitation"
        loading={resending}
        onConfirm={() => void handleResend()}
        onCancel={() => setResendOpen(false)}
      />
    </div>
  )
}

function renderDetail(Icon: typeof Mail, label: string, value: string) {
  return (
    <div className="flex items-start gap-3">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-royal-600/10 text-royal-600">
        <Icon className="h-4.5 w-4.5" aria-hidden="true" />
      </span>
      <div className="min-w-0">
        <p className="text-xs font-semibold uppercase tracking-wider text-ink-500">{label}</p>
        <p className="mt-0.5 break-words text-sm font-medium text-ink-900">{value}</p>
      </div>
    </div>
  )
}