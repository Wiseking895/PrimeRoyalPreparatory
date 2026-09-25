import { useCallback, useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import {
  ArrowLeft,
  Banknote,
  Calendar,
  Camera,
  ChevronRight,
  FileDown,
  IdCard,
  Mail,
  MapPin,
  Pencil,
  Phone,
  Printer,
  ShieldCheck,
  Shirt,
  Trash2,
  UserRound,
  Users,
} from 'lucide-react'
import { useParams, Link } from 'react-router-dom'
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
import type {
  GuardianView,
  PupilGender,
  PupilUniformView,
  PupilView,
  SchoolClassView,
  UniformCollectionStatus,
} from '@/types/portal'
import { cn } from '@/lib/cn'

interface GuardianEditRow {
  id: string
  guardianId: string | null
  fullName: string
  relationship: string
  phone: string
  email: string
  address: string
  occupation: string
  isPrimary: boolean
  isEmergency: boolean
}

/** Canonical names of the five "Uniforms to be Collected" admission items. */
const UNIFORM_NAMES = ['Main Uniform', 'Outing', 'Friday Wear', 'Thursday Wear', 'Cream Uniform']

/** One of the five "Uniforms to be Collected" admission items on the edit form. */
interface UniformEditRow {
  slot: number
  label: string
  status: UniformCollectionStatus
}

interface EditForm {
  pupilId: string
  admissionNumber: string
  sheetNumber: string
  admissionFee: string
  firstName: string
  middleName: string
  lastName: string
  dateOfBirth: string
  gender: PupilGender | ''
  classId: string
  dateAdmitted: string
  address: string
  /** "SCHOOL ATTENDED" on the physical admission form. */
  previousSchool: string
  /** "STAY WITH THE CHILD" living arrangement on the physical admission form. */
  stayWithChild: string
  nationality: string
  religion: string
  admissionReason: string
  declarationAcknowledged: boolean
  guardians: GuardianEditRow[]
  uniforms: UniformEditRow[]
}

/** Always produces the five admission slots, padded with empty/not-collected. */
function toUniformRows(uniforms?: PupilUniformView[]): UniformEditRow[] {
  const bySlot = new Map<number, UniformEditRow>()
  for (const item of uniforms ?? []) {
    if (!bySlot.has(item.slot)) {
      bySlot.set(item.slot, { slot: item.slot, label: item.label ?? '', status: item.status })
    }
  }
  return [1, 2, 3, 4, 5].map(
    (slot) => bySlot.get(slot) ?? { slot, label: '', status: 'NOT_COLLECTED' },
  )
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
    occupation: guardian.occupation ?? '',
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
    occupation: '',
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

  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [deleting, setDeleting] = useState(false)

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
      sheetNumber: pupil.sheetNumber ?? '',
      admissionFee: pupil.admissionFee ?? '',
      firstName: pupil.firstName,
      middleName: pupil.middleName ?? '',
      lastName: pupil.lastName,
      dateOfBirth: toDateValue(pupil.dateOfBirth),
      gender: pupil.gender,
      classId: pupil.classId,
      dateAdmitted: toDateValue(pupil.dateAdmitted),
      address: pupil.address ?? '',
      previousSchool: pupil.previousSchool ?? '',
      stayWithChild: pupil.stayWithChild ?? '',
      nationality: pupil.nationality ?? '',
      religion: pupil.religion ?? '',
      admissionReason: pupil.admissionReason ?? '',
      declarationAcknowledged: pupil.declarationAcknowledged,
      guardians: pupil.guardians.map(toRow),
      uniforms: toUniformRows(pupil.uniforms),
    })
    setFormErrors({})
    setEditing(true)
  }

  const set = (field: Exclude<keyof EditForm, 'guardians' | 'uniforms'>, value: string) => {
    setForm((current) => (current ? { ...current, [field]: value } : current))
    setFormErrors((current) => {
      if (!current[field]) return current
      const next = { ...current }
      delete next[field]
      return next
    })
  }

  const setUniform = (slot: number, field: 'label' | 'status', value: string) => {
    setForm((current) =>
      current
        ? {
            ...current,
            uniforms: current.uniforms.map((item) => {
              if (item.slot !== slot) return item
              return field === 'label'
                ? { ...item, label: value }
                : { ...item, status: value as UniformCollectionStatus }
            }),
          }
        : current,
    )
    setFormErrors((current) => {
      const key = `uniforms.${slot}.label`
      if (!current[key]) return current
      const next = { ...current }
      delete next[key]
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
    if (form.admissionNumber.trim().length > 40) errors.admissionNumber = 'Admission number is too long.'
    if (form.sheetNumber.trim().length > 40) errors.sheetNumber = 'Sheet number is too long.'
    if (form.previousSchool.trim().length > 120)
      errors.previousSchool = 'School attended must be 120 characters or fewer.'
    if (form.stayWithChild.trim().length > 120)
      errors.stayWithChild = 'Stay with the child must be 120 characters or fewer.'
    const feeValue = form.admissionFee.trim()
    if (feeValue && !/^\d+(\.\d{1,2})?$/.test(feeValue)) {
      errors.admissionFee = 'Enter a valid admission fee with up to 2 decimal places.'
    }
    form.uniforms.forEach((item) => {
      if (item.label.trim().length > 80) {
        errors[`uniforms.${item.slot}.label`] = 'Uniform description must be 80 characters or fewer.'
      }
    })
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
        sheetNumber: form.sheetNumber.trim() || null,
        admissionFee: form.admissionFee.trim() || null,
        firstName: form.firstName.trim(),
        middleName: form.middleName.trim() || null,
        lastName: form.lastName.trim(),
        dateOfBirth: form.dateOfBirth,
        gender: form.gender as PupilGender,
        classId: form.classId,
        dateAdmitted: form.dateAdmitted,
        address: form.address.trim() || null,
        previousSchool: form.previousSchool.trim() || null,
        stayWithChild: form.stayWithChild.trim() || null,
        nationality: form.nationality.trim() || null,
        religion: form.religion.trim() || null,
        admissionReason: form.admissionReason.trim() || null,
        declarationAcknowledged: form.declarationAcknowledged,
        uniforms: form.uniforms.map((item) => ({
          slot: item.slot,
          label: item.label.trim() || null,
          status: item.status,
        })),
        guardians: form.guardians.map((guardian) => ({
          fullName: guardian.fullName.trim(),
          relationship: guardian.relationship.trim(),
          phone: guardian.phone.trim() || undefined,
          email: guardian.email.trim() || undefined,
          address: guardian.address.trim() || undefined,
          occupation: guardian.occupation.trim() || undefined,
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

  const handlePictureUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file || !pupil) return
    setUploading(true)
    try {
      const result = await api.uploadPupilPicture(pupil.id, file)
      setPupil((current) => (current ? { ...current, profilePictureUrl: result.profilePictureUrl } : current))
      push('success', 'Profile picture updated.')
    } catch (err) {
      push('error', err instanceof Error ? err.message : 'Upload failed.')
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handlePictureDelete = async () => {
    if (!pupil) return
    setDeleting(true)
    try {
      await api.deletePupilPicture(pupil.id)
      setPupil((current) => (current ? { ...current, profilePictureUrl: null } : current))
      push('success', 'Profile picture removed.')
    } catch (err) {
      push('error', err instanceof Error ? err.message : 'Delete failed.')
    } finally {
      setDeleting(false)
    }
  }

  const admissionFormFilename = () => {
    const raw = ((pupil?.admissionNumber ?? '').trim() || pupil?.pupilId) ?? 'Pupil'
    const safe = raw.replace(/[^A-Za-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '')
    return `PRPS-Admission-Form-${safe || 'Pupil'}.pdf`
  }

  const handleDownloadForm = async () => {
    if (!pupil) return
    setBusyAction('form-pdf')
    try {
      const blob = await api.fetchAdmissionFormPdf(pupil.id)
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = admissionFormFilename()
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(url)
      push('success', 'Admission form downloaded.')
    } catch (err) {
      push('error', err instanceof Error ? err.message : 'Could not download the admission form.')
    } finally {
      setBusyAction(null)
    }
  }

  const handlePrintForm = async () => {
    if (!pupil) return
    setBusyAction('form-pdf')
    try {
      const blob = await api.fetchAdmissionFormPdf(pupil.id)
      const url = URL.createObjectURL(blob)
      const printWindow = window.open(url, '_blank')
      if (!printWindow) {
        URL.revokeObjectURL(url)
        push('error', 'Allow pop-ups to print the admission form.')
        return
      }
      window.setTimeout(() => URL.revokeObjectURL(url), 30_000)
    } catch (err) {
      push('error', err instanceof Error ? err.message : 'Could not prepare the admission form for printing.')
    } finally {
      setBusyAction(null)
    }
  }

  if (error) {
    return (
      <div className="space-y-6 rounded-3xl bg-royal-900 p-5 sm:p-7 lg:p-8">
        <Button variant="outline" size="sm" to={`${basePath}/pupils`}>
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Back to pupils
        </Button>
        <ErrorState message={error} onRetry={() => void load()} />
      </div>
    )
  }

  if (!pupil) {
    return (
      <div className="space-y-6 rounded-3xl bg-royal-900 p-5 sm:p-7 lg:p-8">
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
    <div className="space-y-6 rounded-3xl bg-royal-900 p-5 sm:p-7 lg:p-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs font-semibold text-cream-200/70">
            <Link to={`${basePath}/pupils`} className="transition-colors hover:text-white">
              Pupils
            </Link>
            <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
            <span className="text-gold-300">Profile</span>
          </nav>
          <h1 className="mt-1.5 text-2xl font-extrabold tracking-tight text-white sm:text-3xl">
            Pupil Profile
          </h1>
          <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-cream-200/75">
            Enrolment details, guardians and management for this pupil.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 print:hidden">
          <Button variant="outline" size="sm" to={`${basePath}/pupils`}>
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Back to pupils
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => void handleDownloadForm()}
            disabled={busyAction === 'form-pdf'}
          >
            <FileDown className="h-4 w-4" aria-hidden="true" />
            Download Admission Form (PDF)
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => void handlePrintForm()}
            disabled={busyAction === 'form-pdf'}
          >
            <Printer className="h-4 w-4" aria-hidden="true" />
            Print Admission Form
          </Button>
          {can.update ? (
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
          <div className="flex flex-col items-center gap-3">
            <div className="relative">
              <Avatar
                name={pupil.fullName}
                imageUrl={pupil.profilePictureUrl}
                size="xl"
                className={
                  uploading ? 'opacity-50 ring-4 ring-cream-200' : 'ring-4 ring-cream-200'
                }
              />
              {can.update && (
                <>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    className="hidden"
                    onChange={handlePictureUpload}
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    className="absolute -bottom-1 -right-1 flex h-10 w-10 items-center justify-center rounded-full border-2 border-white bg-royal-700 text-white shadow-md transition-colors hover:bg-royal-800 disabled:cursor-not-allowed disabled:opacity-50"
                    aria-label="Change profile picture"
                  >
                    {uploading ? (
                      <Spinner className="h-4 w-4" />
                    ) : (
                      <Camera className="h-4 w-4" aria-hidden="true" />
                    )}
                  </button>
                </>
              )}
            </div>
            {can.update && (
              <div className="flex flex-col items-center gap-1">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="text-sm font-bold text-royal-700 underline-offset-2 transition-colors hover:text-magenta-600 hover:underline disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {uploading ? 'Uploading…' : pupil.profilePictureUrl ? 'Change Photo' : 'Upload Photo'}
                </button>
                <p className="text-xs text-ink-500">JPG, PNG, WebP or GIF / Maximum 5 MB</p>
              </div>
            )}
            {can.update && pupil.profilePictureUrl && (
              <button
                type="button"
                onClick={handlePictureDelete}
                disabled={deleting}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-red-600 transition-colors hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {deleting ? (
                  <Spinner className="h-3.5 w-3.5" />
                ) : (
                  <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                )}
                Remove Photo
              </button>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-xl font-extrabold tracking-tight text-royal-800">{pupil.fullName}</p>
              <StatusBadge status={pupil.status} />
            </div>
            <p className="mt-0.5 text-sm text-ink-500">{pupil.pupilId} · {pupil.className}</p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-gold-400/20 px-2.5 py-1 text-xs font-bold text-gold-700 ring-1 ring-inset ring-gold-500/30">
                {pupil.gender === 'MALE' ? 'Male' : 'Female'}
              </span>
              {pupil.admissionNumber ? (
                <span className="rounded-full bg-cream-100 px-2.5 py-1 text-xs font-semibold text-ink-700 ring-1 ring-inset ring-cream-300">
                  {pupil.admissionNumber}
                </span>
              ) : null}
            </div>
          </div>
        </div>
      </Card>

      {editing && form ? (
        <Card className="p-6">
          <h2 className="text-sm font-bold uppercase tracking-wider text-royal-800">Edit pupil profile</h2>
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
              label="Sheet number"
              name="sheetNumber"
              value={form.sheetNumber}
              onChange={(event) => set('sheetNumber', event.target.value)}
              error={formErrors.sheetNumber}
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
            <TextField
              label="School attended"
              name="previousSchool"
              value={form.previousSchool}
              onChange={(event) => set('previousSchool', event.target.value)}
              error={formErrors.previousSchool}
              hint="Previous school listed on the admission form, if any."
            />
            <TextField
              label="Stay with the child"
              name="stayWithChild"
              value={form.stayWithChild}
              onChange={(event) => set('stayWithChild', event.target.value)}
              error={formErrors.stayWithChild}
              hint="Who the child lives with, e.g. Father, Mother or Guardian."
            />
            <TextField
              label="Nationality"
              name="nationality"
              value={form.nationality}
              onChange={(event) => set('nationality', event.target.value)}
              error={formErrors.nationality}
            />
            <TextField
              label="Religion"
              name="religion"
              value={form.religion}
              onChange={(event) => set('religion', event.target.value)}
              error={formErrors.religion}
            />
            <TextField
              label="Reason for choosing school"
              name="admissionReason"
              value={form.admissionReason}
              onChange={(event) => set('admissionReason', event.target.value)}
              error={formErrors.admissionReason}
            />
            <TextField
              label="Admission fee (GH₵)"
              name="admissionFee"
              value={form.admissionFee}
              onChange={(event) => set('admissionFee', event.target.value)}
              error={formErrors.admissionFee}
              hint="One-time amount recorded with this admission record - not daily, PA or maintenance fees."
            />

            <div className="sm:col-span-2">
              <p className="text-xs font-bold uppercase tracking-wider text-ink-500">Uniforms to be Collected</p>
            </div>
            <div className="sm:col-span-2 rounded-xl border border-cream-200 bg-cream-50 p-4">
              <div className="grid gap-4 sm:grid-cols-2">
                {form.uniforms.map((item) => (
                  <div key={item.slot} className="rounded-xl border border-cream-200 bg-white p-3">
                    <p className="text-xs font-bold uppercase tracking-wider text-ink-500">
                      {UNIFORM_NAMES[item.slot - 1]}
                    </p>
                    <div className="mt-2">
                      <SelectField
                        label="Collection status"
                        name={`uniform-${item.slot}-status`}
                        value={item.status}
                        onChange={(event) => setUniform(item.slot, 'status', event.target.value)}
                        options={[
                          { value: 'NOT_COLLECTED', label: 'Not collected' },
                          { value: 'COLLECTED', label: 'Collected' },
                        ]}
                        placeholder="Select a status"
                        error={formErrors[`uniforms.${item.slot}.status`]}
                      />
                    </div>
                  </div>
                ))}
              </div>
              <p className="mt-3 text-xs text-ink-500">
                &quot;Collected&quot; means the uniform item was physically handed over to the pupil or
                guardian.
              </p>
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
                  <TextField
                    label="Occupation"
                    name={`guardian-${guardian.id}-occupation`}
                    value={guardian.occupation}
                    onChange={(event) => setGuardian(guardian.id, 'occupation', event.target.value)}
                    error={formErrors[`guardians.${guardian.id}.occupation`]}
                  />
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
            <h2 className="text-sm font-bold uppercase tracking-wider text-royal-800">Pupil details</h2>
            <dl className="mt-4 grid gap-x-6 gap-y-4 sm:grid-cols-2">
              {renderDetail(IdCard, 'Pupil ID', pupil.pupilId)}
              {renderDetail(ShieldCheck, 'Admission no.', pupil.admissionNumber ?? '—')}
              {renderDetail(IdCard, 'Sheet no.', pupil.sheetNumber ?? '—')}
              {renderDetail(Banknote, 'Admission fee', pupil.admissionFee ? `GH₵ ${pupil.admissionFee}` : '—')}
              {renderDetail(UserRound, 'Gender', pupil.gender === 'MALE' ? 'Male' : 'Female')}
              {renderDetail(Calendar, 'Date of birth', formatDate(pupil.dateOfBirth))}
              {renderDetail(Calendar, 'Date admitted', formatDate(pupil.dateAdmitted))}
              {renderDetail(MapPin, 'Home address', pupil.address ?? '—')}
              {renderDetail(UserRound, 'School attended', pupil.previousSchool ?? '—')}
              {renderDetail(Users, 'Stay with the child', pupil.stayWithChild ?? '—')}
              {renderDetail(UserRound, 'Nationality', pupil.nationality ?? '—')}
              {renderDetail(UserRound, 'Religion', pupil.religion ?? '—')}
              {renderDetail(UserRound, 'Reason for choosing school', pupil.admissionReason ?? '—')}
            </dl>
          </Card>

          {/* Guardians */}
          <Card className="p-6">
            <div className="flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-royal-800">
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

          {/* Uniforms to be collected */}
          <Card className="p-6 lg:col-span-2">
            <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-royal-800">
              <Shirt className="h-4 w-4" aria-hidden="true" />
              Uniforms to be Collected
            </h2>
            <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              {pupil.uniforms.map((item, index) => (
                <li key={item.slot} className="rounded-xl border border-cream-200 bg-cream-50 p-4">
                  <p className="text-xs font-bold uppercase tracking-wider text-ink-500">
                    {UNIFORM_NAMES[index]}
                  </p>
                  <p className="mt-1 break-words text-sm font-semibold text-ink-900">
                    {item.label || '—'}
                  </p>
                  <div className="mt-2">
                    <Badge tone={item.status === 'COLLECTED' ? 'green' : 'amber'}>
                      {item.status === 'COLLECTED' ? 'Collected' : 'Not collected'}
                    </Badge>
                  </div>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      )}

      {/* Management actions */}
      {can.update ? (
        <Card className="p-6">
          <h2 className="text-sm font-bold uppercase tracking-wider text-royal-800">Pupil management</h2>
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