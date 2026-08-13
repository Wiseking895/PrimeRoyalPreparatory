import { useState } from 'react'
import type { FormEvent } from 'react'
import {
  Calendar,
  KeyRound,
  Mail,
  MapPin,
  Phone,
  Pencil,
  ShieldCheck,
  Trash2,
  UserRound,
} from 'lucide-react'
import { Modal } from '@/components/dashboard/Modal'
import { Avatar } from '@/components/dashboard/Avatar'
import { StatusBadge, Badge } from '@/components/dashboard/Badge'
import { Button } from '@/components/ui/Button'
import { TextField, SelectField, TextAreaField } from '@/components/dashboard/Field'
import { Spinner } from '@/components/dashboard/Loaders'
import { api } from '@/lib/api'
import type { RoleDefinition, StaffView } from '@/types/portal'
import { formatDate } from '@/lib/date'
import { cn } from '@/lib/cn'

interface Can {
  update: boolean
  assignRole: boolean
  removeRole: boolean
}

interface StaffProfileModalProps {
  staff: StaffView | null
  isSelf: boolean
  roles: RoleDefinition[]
  can: Can
  onClose: () => void
  onUpdated: (staff: StaffView) => void
  onToast: (tone: 'success' | 'error', message: string) => void
}

export function StaffProfileModal({
  staff,
  isSelf,
  roles,
  can,
  onClose,
  onUpdated,
  onToast,
}: StaffProfileModalProps) {
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({ firstName: '', lastName: '', email: '', phone: '', address: '', responsibilities: '' })
  const [formErrors, setFormErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [roleValue, setRoleValue] = useState('')
  const [assignLoading, setAssignLoading] = useState(false)
  const [busyAction, setBusyAction] = useState<string | null>(null)

  const open = staff !== null

  const startEditing = () => {
    if (!staff) return
    const names = staff.fullName.trim().split(/\s+/)
    setForm({
      firstName: names[0] ?? '',
      lastName: names.slice(1).join(' '),
      email: staff.email,
      phone: staff.phone ?? '',
      address: staff.address ?? '',
      responsibilities: staff.responsibilities ?? '',
    })
    setFormErrors({})
    setEditing(true)
  }

  const handleEdit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!staff) return
    setSaving(true)
    try {
      const updated = await api.updateStaff(staff.id, {
        firstName: form.firstName,
        lastName: form.lastName,
        email: form.email,
        phone: form.phone || undefined,
        address: form.address || undefined,
        responsibilities: form.responsibilities || undefined,
      })
      onUpdated(updated)
      setEditing(false)
      onToast('success', 'Staff profile updated.')
    } catch (err) {
      onToast('error', err instanceof Error ? err.message : 'Could not update the profile.')
    } finally {
      setSaving(false)
    }
  }

  const handleAssignRole = async () => {
    if (!staff || !roleValue) return
    setAssignLoading(true)
    try {
      const updated = await api.assignRole(staff.id, roleValue)
      onUpdated(updated)
      setRoleValue('')
      onToast('success', `${staff.fullName} assigned the ${roleValue} role.`)
    } catch (err) {
      onToast('error', err instanceof Error ? err.message : 'Could not assign the role.')
    } finally {
      setAssignLoading(false)
    }
  }

  const handleRemoveRole = async () => {
    if (!staff) return
    setBusyAction('remove')
    try {
      const updated = await api.removeRole(staff.id)
      onUpdated(updated)
      onToast('success', `${staff.fullName} no longer has a staff role.`)
    } catch (err) {
      onToast('error', err instanceof Error ? err.message : 'Could not remove the role.')
    } finally {
      setBusyAction(null)
    }
  }

  const handleToggleStatus = async () => {
    if (!staff) return
    const next = staff.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE'
    setBusyAction('status')
    try {
      const updated = await api.setStaffStatus(staff.id, next)
      onUpdated(updated)
      onToast('success', next === 'ACTIVE' ? `${staff.fullName} activated.` : `${staff.fullName} deactivated.`)
    } catch (err) {
      onToast('error', err instanceof Error ? err.message : 'Could not update the account.')
    } finally {
      setBusyAction(null)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Staff Profile" size="lg">
      {staff ? (
        <div className="space-y-6">
          {/* Identity */}
          <div className="flex items-center gap-4">
            <Avatar name={staff.fullName} size="lg" />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-lg font-bold text-ink-900">{staff.fullName}</p>
                <StatusBadge status={staff.status} />
              </div>
              <p className="mt-0.5 text-sm text-ink-500">
                {staff.staffId} · {staff.email}
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                <Badge tone={staff.category === 'TEACHING' ? 'magenta' : 'royal'}>
                  {staff.category?.replace('_', ' ') ?? 'Staff'}
                </Badge>
                {staff.roles.map((role) => (
                  <Badge key={role} tone="green">
                    {role}
                  </Badge>
                ))}
              </div>
            </div>
            {!isSelf && can.update ? (
              <Button variant="soft" size="sm" onClick={startEditing}>
                <Pencil className="h-4 w-4" aria-hidden="true" />
                Edit
              </Button>
            ) : null}
          </div>

          {editing ? (
            <form onSubmit={handleEdit} noValidate className="grid gap-4 sm:grid-cols-2">
              <TextField
                label="First name"
                name="firstName"
                value={form.firstName}
                onChange={(event) => setForm((current) => ({ ...current, firstName: event.target.value }))}
                error={formErrors.firstName}
                required
              />
              <TextField
                label="Last name"
                name="lastName"
                value={form.lastName}
                onChange={(event) => setForm((current) => ({ ...current, lastName: event.target.value }))}
                error={formErrors.lastName}
                required
              />
              <div className="sm:col-span-2">
                <TextField
                  label="Email"
                  name="email"
                  type="email"
                  value={form.email}
                  onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
                  error={formErrors.email}
                  required
                />
              </div>
              <TextField
                label="Phone"
                name="phone"
                value={form.phone}
                onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))}
              />
              <TextField
                label="Address"
                name="address"
                value={form.address}
                onChange={(event) => setForm((current) => ({ ...current, address: event.target.value }))}
              />
              <div className="sm:col-span-2">
                <TextAreaField
                  label="Responsibilities"
                  name="responsibilities"
                  value={form.responsibilities}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, responsibilities: event.target.value }))
                  }
                />
              </div>
              <div className="flex justify-end gap-2 sm:col-span-2">
                <Button variant="cream" type="button" onClick={() => setEditing(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={saving}>
                  {saving ? <Spinner className="h-4 w-4" /> : null}
                  Save changes
                </Button>
              </div>
            </form>
          ) : (
            <>
              {/* Details */}
              <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
                {renderDetail(Calendar, 'Date joined', staff.dateJoined ? formatDate(staff.dateJoined) : '—')}
                {renderDetail(Mail, 'Email', staff.email)}
                {renderDetail(Phone, 'Phone', staff.phone ?? '—')}
                {renderDetail(MapPin, 'Address', staff.address ?? '—')}
              </dl>
              {staff.responsibilities ? (
                <p className="text-sm leading-relaxed text-ink-700">
                  <span className="font-semibold text-ink-900">Responsibilities:</span>{' '}
                  {staff.responsibilities}
                </p>
              ) : null}

              {/* Permissions summary */}
              <div className="rounded-xl border border-cream-200 bg-cream-50 p-4">
                <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-ink-500">
                  <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                  Permissions via role
                </p>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {staff.permissions.length > 0 ? (
                    staff.permissions.map((permission) => (
                      <span
                        key={permission}
                        className="rounded-full bg-white px-2.5 py-1 text-xs font-medium text-ink-700 ring-1 ring-inset ring-cream-300"
                      >
                        {permission}
                      </span>
                    ))
                  ) : (
                    <span className="text-sm text-ink-500">This account has no assigned permissions.</span>
                  )}
                </div>
              </div>

              {/* Management actions */}
              <div className="flex flex-wrap items-center gap-2 border-t border-cream-200 pt-5">
                {can.assignRole ? (
                  <div className="flex flex-1 flex-wrap items-center gap-2">
                    <SelectField
                      label=""
                      name="assignRole"
                      value={roleValue}
                      onChange={(event) => setRoleValue(event.target.value)}
                      options={roles.map((role) => ({ value: role.name, label: role.label }))}
                      placeholder="Assign a staff role"
                      className="min-w-44 flex-1"
                    />
                    <button
                      type="button"
                      disabled={!roleValue || assignLoading}
                      onClick={() => void handleAssignRole()}
                      className="inline-flex items-center gap-2 rounded-full bg-royal-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-royal-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {assignLoading ? <Spinner className="h-4 w-4" /> : <KeyRound className="h-4 w-4" aria-hidden="true" />}
                      Assign role
                    </button>
                  </div>
                ) : (
                  <span className="flex items-center gap-2 text-sm text-ink-500">
                    <KeyRound className="h-4 w-4" aria-hidden="true" />
                    Role assignment requires the assign-role permission.
                  </span>
                )}

                {can.removeRole && staff.roles.length > 0 ? (
                  <button
                    type="button"
                    onClick={() => void handleRemoveRole()}
                    disabled={busyAction === 'remove'}
                    className="inline-flex items-center gap-2 rounded-full border border-red-200 px-4 py-2.5 text-sm font-semibold text-red-700 transition-colors hover:bg-red-50 disabled:opacity-50"
                  >
                    {busyAction === 'remove' ? (
                      <Spinner className="h-4 w-4" />
                    ) : (
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                    )}
                    Remove role
                  </button>
                ) : null}

                {!isSelf && can.update ? (
                  <button
                    type="button"
                    onClick={() => void handleToggleStatus()}
                    disabled={busyAction === 'status'}
                    className={cn(
                      'inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold transition-colors disabled:opacity-50',
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
            </>
          )}
        </div>
      ) : null}
    </Modal>
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