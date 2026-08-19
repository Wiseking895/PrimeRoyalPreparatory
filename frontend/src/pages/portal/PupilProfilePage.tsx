import { useCallback, useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import {
  ArrowLeft,
  Calendar,
  IdCard,
  Mail,
  MapPin,
  Pencil,
  Phone,
  ShieldCheck,
  UserRound,
  Users,
} from 'lucide-react'
import { useParams } from 'react-router-dom'
import { OWNER_ROLE } from '@/auth/roles'
import { useAuth } from '@/auth/AuthContext'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Avatar } from '@/components/dashboard/Avatar'
import { StatusBadge, Badge } from '@/components/dashboard/Badge'
import { ConfirmDialog } from '@/components/dashboard/ConfirmDialog'
import { TextField, SelectField, TextAreaField } from '@/components/dashboard/Field'
import { Spinner, CardSkeleton } from '@/components/dashboard/Loaders'
import { ErrorState, EmptyState } from '@/components/dashboard/States'
import { useToast } from '@/components/dashboard/Toast'
import { api } from '@/lib/api'
import { formatDate } from '@/lib/date'
import type { GuardianView, PupilGender, PupilView, SchoolClassView } from '@/types/portal'
import { cn } from '@/lib/cn'

interface GuardianEditRow {
  id: string
  guardianId: string | null
  fullName: string
  relationship: string
  phone: string
  email: string
  address: string
  isPrimary: boolean
  isEmergency: boolean
}

interface EditForm {
  pupilId: string
  admissionNumber: string
  firstName: string
  middleName: string
  lastName: string
  dateOfBirth: string
  gender: PupilGender | ''
  classId: string
  dateAdmitted: string
  address: string
  guardians: GuardianEditRow[]
}

let guardianSeq = 0

function toRow(guardian: GuardianView): GuardianEditRow {
  guardianSeq += 1
  return {
    id: `guardian-${guardianSeq}`,
    guardianId: guardian.id,
    fullName: guardian.fullName,
    relationship: guardian.relationship ?? '',
    phone: guardian.phone ?? '',
    email: guardian.email ?? '',
    address: guardian.address ?? '',
    isPrimary: guardian.isPrimary,
    isEmergency: guardian.isEmergency,
  }
}

function newRow(): GuardianEditRow {
  guardianSeq += 1
  return {
    id: `guardian-${guardianSeq}`,
    guardianId: null,
    fullName: '',
    relationship: '',
    phone: '',
    email: '',
    address: '',
    isPrimary: false,
    isEmergency: false,
  }
}

function toDateValue(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso.slice(0, 10)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function PupilProfilePage() {
  const { id } = useParams<{ id: string }>()
  const { push } = useToast()
  const { user, hasPermission } = useAuth()

  const basePath = user?.roles.includes(OWNER_ROLE) ? '/owner' : '/headteacher'

  const [pupil, setPupil] = useState<PupilView | null>(null)
  const [classes, setClasses] = useState<SchoolClassView[]>([])
  const [error, setError] = useState<string | null>(null)

  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState<EditForm | null>(null)
  const [formErrors, setFormErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)

  const [confirmStatus, setConfirmStatus] = useState<'ACTIVE' | 'INACTIVE' | null>(null)
  const [busyAction, setBusyAction] = useState<string | null>(null)

  const can = {
    update: hasPermission('pupils.update'),
  }

  const load = useCallback(async () => {
    if (!id) return
    setError(null)
    try {
      const [pupilData, classData] = await Promise.all([api.getPupil(id), api.listClasses()])
      setPupil(pupilData)
      setClasses(classData)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load the pupil profile.')
    }
  }, [id])

  useEffect(() => {
    void load()
  }, [load])

  const startEditing = () => {
    if (!pupil) return
    setForm({
      pupilId: pupil.pupilId,
      admissionNumber: pupil.admissionNumber ?? '',
      firstName: pupil.firstName,
      middleName: pupil.middleName ?? '',
      lastName: pupil.lastName,
      dateOfBirth: toDateValue(pupil.dateOfBirth),
      gender: pupil.gender,
      classId: pupil.classId,
      dateAdmitted: toDateValue(pupil.dateAdmitted),
      address: pupil.address ?? '',
      guardians: pupil.guardians.map(toRow),
    })
    setFormErrors({})
    setEditing(true)
  }

  const set = (field: Exclude<keyof EditForm, 'guardians'>, value: string) => {
    setForm((current) => (current ? { ...current, [field]: value } : current))
    setFormErrors((current) => {
      if (!current[field]) return current
      const next = { ...current }
      delete next[field]
      return next
    })
  }

  const setGuardian = (rowId: string, field: keyof GuardianEditRow, value: string | boolean) => {
    setForm((current) =>
      current
        ? {
            ...current,
            guardians: current.guardians.map((guardian) =>
              guardian.id === rowId ? { ...guardian, [field]: value } : guardian,
            ),
          }
        : current,
    )
    setFormErrors((current) => {
      const next = { ...current }
      delete next[`guardians.${rowId}.${field}`]
      return next
    })
  }

  const addGuardian = () => {
    setForm((current) => (current ? { ...current, guardians: [...current.guardians, newRow()] } : current))
  }

  const removeGuardian = (rowId: string) => {
    setForm((current) =>
      current
        ? { ...current, guardians: current.guardians.filter((guardian) => guardian.id !== rowId) }
        : current,
    )
  }

  const handleEdit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!pupil || !form) return
    const errors: Record<string, string> = {}
    if (form.firstName.trim().length < 2) errors.firstName = 'First name must be at least 2 characters.'
    if (form.lastName.trim().length < 2) errors.lastName = 'Last name must be at least 2 characters.'
    if (!form.dateOfBirth) errors.dateOfBirth = 'Date of birth is required.'
    if (!form.gender) errors.gender = 'Select a gender.'
    if (!form.classId) errors.classId = 'Select a class.'
    if (form.guardians.length === 0) {
      errors.guardians = 'At least one guardian is required.'
    } else {
      form.guardians.forEach((guardian) => {
        if (guardian.fullName.trim().length < 2)
          errors[`guardians.${guardian.id}.fullName`] = 'Guardian name must be at least 2 characters.'
        if (!guardian.relationship.trim())
          errors[`guardians.${guardian.id}.relationship`] = 'Relationship is required.'
      })
    }
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors)
      return
    }

    setSaving(true)
    try {
      const updated = await api.updatePupil(pupil.id, {
        pupilId: form.pupilId.trim() || undefined,
        admissionNumber: form.admissionNumber.trim() || null,
        firstName: form.firstName.trim(),
        middleName: form.middleName.trim() || null,
        lastName: form.lastName.trim(),
        dateOfBirth: form.dateOfBirth,
        gender: form.gender as PupilGender,
        classId: form.classId,
        dateAdmitted: form.dateAdmitted,
        address: form.address.trim() || null,
        guardians: form.guardians.map((guardian) => ({
          fullName: guardian.fullName.trim(),
          relationship: guardian.relationship.trim(),
          phone: guardian.phone.trim() || undefined,
          email: guardian.email.trim() || undefined,
          address: guardian.address.trim() || undefined,
          isPrimary: guardian.isPrimary,
          isEmergency: guardian.isEmergency,
        })),
      })
      setPupil(updated)
      setEditing(false)
      push('success', 'Pupil profile updated.')
    } catch (err) {
      const apiError = err as { fieldErrors?: Record<string, string> }
      if (apiError.fieldErrors && Object.keys(apiError.fieldErrors).length > 0) {
        setFormErrors(apiError.fieldErrors)
      } else {
        push('error', err instanceof Error ? err.message : 'Could not update the pupil profile.')
      }
    } finally {
      setSaving(false)
    }
  }

  const handleToggleStatus = async () => {
    if (!pupil || !confirmStatus) return
    setBusyAction('status')
    try {
      const updated = await api.setPupilStatus(pupil.id, confirmStatus)
      setPupil(updated)
      push('success', confirmStatus === 'ACTIVE' ? `${updated.fullName} activated.` : `${updated.fullName} deactivated.`)
    } catch (err) {
      push('error', err instanceof Error ? err.message : 'Could not update the pupil record.')
    } finally {
      setBusyAction(null)
      setConfirmStatus(null)
    }
  }

  const nextStatus: 'ACTIVE' | 'INACTIVE' = pupil?.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE'

  if (error) {
    return (
      <div className="space-y-6">
        <Button variant="ghost-dark" size="sm" to={`${basePath}/pupils`}>
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Back to pupils
        </Button>
        <ErrorState message={error} onRetry={() => void load()} />
      </div>
    )
  }

  if (!pupil) {
    return (
      <div className="space-y-6">
        <CardSkeleton />
        <CardSkeleton />
        <CardSkeleton />
      </div>
    )
  }

  const classOptions = classes
    .filter((klass) => klass.status === 'ACTIVE' || klass.id === form?.classId)
    .map((klass) => ({ value: klass.id, label: klass.name }))

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <Button variant="ghost-dark" size="sm" to={`${basePath}/pupils`}>
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Back to pupils
        </Button>
        {can.update ? (
          <Button variant="soft" size="sm" onClick={() => (editing ? setEditing(false) : startEditing())}>
            <Pencil className="h-4 w-4" aria-hidden="true" />
            {editing ? 'Cancel' : 'Edit'}
          </Button>
        ) : null}
      </div>

      {/* Identity */}
      <Card className="p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <Avatar name={pupil.fullName} size="lg" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-xl font-bold text-ink-900">{pupil.fullName}</p>
              <StatusBadge status={pupil.status} />
            </div>
            <p className="mt-0.5 text-sm text-ink-500">{pupil.pupilId} · {pupil.className}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <Badge tone={pupil.gender === 'MALE' ? 'royal' : 'magenta'}>
                {pupil.gender === 'MALE' ? 'Male' : 'Female'}
              </Badge>
              {pupil.admissionNumber ? <Badge tone="green">{pupil.admissionNumber}</Badge> : null}
            </div>
          </div>
        </div>
      </Card>

      {editing && form ? (
        <Card className="p-6">
          <h2 className="text-sm font-bold uppercase tracking-wider text-ink-500">Edit pupil profile</h2>
          <form onSubmit={handleEdit} noValidate className="mt-4 grid gap-4 sm:grid-cols-2">
            <TextField
              label="First name"
              name="firstName"
              value={form.firstName}
              onChange={(event) => set('firstName', event.target.value)}
              error={formErrors.firstName}
              required
            />
            <TextField
              label="Last name"
              name="lastName"
              value={form.lastName}
              onChange={(event) => set('lastName', event.target.value)}
              error={formErrors.lastName}
              required
            />
            <TextField
              label="Middle name"
              name="middleName"
              value={form.middleName}
              onChange={(event) => set('middleName', event.target.value)}
              error={formErrors.middleName}
            />
            <TextField
              label="Date of birth"
              name="dateOfBirth"
              type="date"
              value={form.dateOfBirth}
              onChange={(event) => set('dateOfBirth', event.target.value)}
              error={formErrors.dateOfBirth}
              required
            />
            <SelectField
              label="Gender"
              name="gender"
              value={form.gender}
              onChange={(event) => set('gender', event.target.value)}
              options={[
                { value: 'MALE', label: 'Male' },
                { value: 'FEMALE', label: 'Female' },
              ]}
              placeholder="Select a gender"
              error={formErrors.gender}
              required
            />
            <SelectField
              label="Class"
              name="classId"
              value={form.classId}
              onChange={(event) => set('classId', event.target.value)}
              options={classOptions}
              placeholder={classes.length > 0 ? 'Select a class' : 'No classes available yet'}
              error={formErrors.classId}
              required
            />
            <TextField
              label="Pupil ID"
              name="pupilId"
              value={form.pupilId}
              onChange={(event) => set('pupilId', event.target.value)}
              error={formErrors.pupilId}
              autoComplete="off"
            />
            <TextField
              label="Admission number"
              name="admissionNumber"
              value={form.admissionNumber}
              onChange={(event) => set('admissionNumber', event.target.value)}
              error={formErrors.admissionNumber}
            />
            <TextField
              label="Date admitted"
              name="dateAdmitted"
              type="date"
              value={form.dateAdmitted}
              onChange={(event) => set('dateAdmitted', event.target.value)}
              error={formErrors.dateAdmitted}
            />
            <div className="sm:col-span-2">
              <TextAreaField
                label="Home address"
                name="address"
                value={form.address}
                onChange={(event) => set('address', event.target.value)}
                error={formErrors.address}
              />
            </div>

            <div className="sm:col-span-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold uppercase tracking-wider text-ink-500">Guardians</p>
                {form.guardians.length < 6 ? (
                  <button
                    type="button"
                    onClick={addGuardian}
                    className="inline-flex items-center gap-1 text-sm font-semibold text-magenta-600 transition-colors hover:text-magenta-700"
                  >
                    <Pencil className="h-4 w-4" aria-hidden="true" />
                    Add guardian
                  </button>
                ) : null}
              </div>
              {formErrors.guardians ? (
                <p role="alert" className="mt-1.5 text-xs font-medium text-red-600">
                  {formErrors.guardians}
                </p>
              ) : null}
            </div>

            {form.guardians.map((guardian, index) => (
              <div key={guardian.id} className="sm:col-span-2 rounded-xl border border-cream-200 bg-cream-50 p-4">
                <div className="mb-3 flex items-center justify-between">
                  <p className="text-sm font-bold text-ink-900">Guardian {index + 1}</p>
                  {form.guardians.length > 1 ? (
                    <button
                      type="button"
                      onClick={() => removeGuardian(guardian.id)}
                      className="text-xs font-semibold text-red-600 transition-colors hover:text-red-700"
                    >
                      Remove
                    </button>
                  ) : null}
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <TextField
                    label="Full name"
                    name={`guardian-${guardian.id}-fullName`}
                    value={guardian.fullName}
                    onChange={(event) => setGuardian(guardian.id, 'fullName', event.target.value)}
                    error={formErrors[`guardians.${guardian.id}.fullName`]}
                    required
                  />
                  <TextField
                    label="Relationship"
                    name={`guardian-${guardian.id}-relationship`}
                    value={guardian.relationship}
                    onChange={(event) => setGuardian(guardian.id, 'relationship', event.target.value)}
                    error={formErrors[`guardians.${guardian.id}.relationship`]}
                    placeholder="e.g. Parent, Guardian"
                    required
                  />
                  <TextField
                    label="Phone"
                    name={`guardian-${guardian.id}-phone`}
                    type="tel"
                    value={guardian.phone}
                    onChange={(event) => setGuardian(guardian.id, 'phone', event.target.value)}
                    error={formErrors[`guardians.${guardian.id}.phone`]}
                  />
                  <TextField
                    label="Email"
                    name={`guardian-${guardian.id}-email`}
                    type="email"
                    value={guardian.email}
                    onChange={(event) => setGuardian(guardian.id, 'email', event.target.value)}
                    error={formErrors[`guardians.${guardian.id}.email`]}
                  />
                  <div className="sm:col-span-2">
                    <TextField
                      label="Address"
                      name={`guardian-${guardian.id}-address`}
                      value={guardian.address}
                      onChange={(event) => setGuardian(guardian.id, 'address', event.target.value)}
                      error={formErrors[`guardians.${guardian.id}.address`]}
                    />
                  </div>
                  <label className="flex items-center gap-2 text-sm font-semibold text-ink-900">
                    <input
                      type="checkbox"
                      checked={guardian.isPrimary}
                      onChange={(event) => setGuardian(guardian.id, 'isPrimary', event.target.checked)}
                      className="h-4 w-4 rounded border-cream-300 text-magenta-600 focus:ring-magenta-500"
                    />
                    Primary guardian
                  </label>
                  <label className="flex items-center gap-2 text-sm font-semibold text-ink-900">
                    <input
                      type="checkbox"
                      checked={guardian.isEmergency}
                      onChange={(event) => setGuardian(guardian.id, 'isEmergency', event.target.checked)}
                      className="h-4 w-4 rounded border-cream-300 text-magenta-600 focus:ring-magenta-500"
                    />
                    Emergency contact
                  </label>
                </div>
              </div>
            ))}

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
        </Card>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Details */}
          <Card className="p-6">
            <h2 className="text-sm font-bold uppercase tracking-wider text-ink-500">Pupil details</h2>
            <dl className="mt-4 grid gap-x-6 gap-y-4 sm:grid-cols-2">
              {renderDetail(IdCard, 'Pupil ID', pupil.pupilId)}
              {renderDetail(ShieldCheck, 'Admission no.', pupil.admissionNumber ?? '—')}
              {renderDetail(UserRound, 'Gender', pupil.gender === 'MALE' ? 'Male' : 'Female')}
              {renderDetail(Calendar, 'Date of birth', formatDate(pupil.dateOfBirth))}
              {renderDetail(Calendar, 'Date admitted', formatDate(pupil.dateAdmitted))}
              {renderDetail(MapPin, 'Home address', pupil.address ?? '—')}
            </dl>
          </Card>

          {/* Guardians */}
          <Card className="p-6">
            <div className="flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-ink-500">
                <Users className="h-4 w-4" aria-hidden="true" />
                Guardians
              </h2>
            </div>
            {pupil.guardians.length === 0 ? (
              <EmptyState title="No guardians recorded yet." />
            ) : (
              <ul className="mt-4 space-y-3">
                {pupil.guardians.map((guardian) => (
                  <li key={guardian.id} className="rounded-xl border border-cream-200 bg-cream-50 p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-bold text-ink-900">{guardian.fullName}</p>
                      {guardian.isPrimary ? <Badge tone="royal">Primary</Badge> : null}
                      {guardian.isEmergency ? <Badge tone="amber">Emergency contact</Badge> : null}
                    </div>
                    <p className="mt-1 text-xs text-ink-500">{guardian.relationship ?? 'Guardian'}</p>
                    <div className="mt-2 space-y-1 text-xs text-ink-700">
                      {guardian.phone ? (
                        <p className="flex items-center gap-2">
                          <Phone className="h-3.5 w-3.5 text-ink-500" aria-hidden="true" />
                          {guardian.phone}
                        </p>
                      ) : null}
                      {guardian.email ? (
                        <p className="flex items-center gap-2">
                          <Mail className="h-3.5 w-3.5 text-ink-500" aria-hidden="true" />
                          {guardian.email}
                        </p>
                      ) : null}
                      {guardian.address ? (
                        <p className="flex items-center gap-2">
                          <MapPin className="h-3.5 w-3.5 text-ink-500" aria-hidden="true" />
                          {guardian.address}
                        </p>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      )}

      {/* Management actions */}
      {can.update ? (
        <Card className="p-6">
          <h2 className="text-sm font-bold uppercase tracking-wider text-ink-500">Pupil management</h2>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setConfirmStatus(nextStatus)}
              disabled={busyAction === 'status'}
              className={cn(
                'inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition-colors disabled:opacity-50',
                pupil.status === 'ACTIVE'
                  ? 'border border-red-200 text-red-700 hover:bg-red-50'
                  : 'bg-emerald-600 text-white hover:bg-emerald-700',
              )}
            >
              {busyAction === 'status' ? <Spinner className="h-4 w-4" /> : <UserRound className="h-4 w-4" aria-hidden="true" />}
              {pupil.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}
            </button>
          </div>
          <p className="mt-3 text-xs leading-relaxed text-ink-500">
            Deactivating a pupil marks them as no longer enrolled while keeping their full record and guardian
            contacts for reference.
          </p>
        </Card>
      ) : null}

      {/* Status confirm */}
      <ConfirmDialog
        open={confirmStatus !== null}
        title={nextStatus === 'ACTIVE' ? 'Activate pupil' : 'Deactivate pupil'}
        message={
          nextStatus === 'ACTIVE'
            ? `Activating ${pupil.fullName} marks them as an active enrolled pupil again.`
            : `Deactivating ${pupil.fullName} marks them as no longer enrolled. The pupil record and guardian contacts are kept for reference.`
        }
        confirmLabel={nextStatus === 'ACTIVE' ? 'Activate' : 'Deactivate'}
        loading={busyAction === 'status'}
        onConfirm={() => void handleToggleStatus()}
        onCancel={() => setConfirmStatus(null)}
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