import { useCallback, useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import {
  BookOpenCheck,
  ChevronLeft,
  ChevronRight,
  GraduationCap,
  Plus,
  Search,
  UserPlus,
  Users,
} from 'lucide-react'
import { OWNER_ROLE } from '@/auth/roles'
import { useAuth } from '@/auth/AuthContext'
import { PageHeader } from '@/components/dashboard/PageHeader'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Avatar } from '@/components/dashboard/Avatar'
import { StatusBadge } from '@/components/dashboard/Badge'
import { Modal } from '@/components/dashboard/Modal'
import { TextField, SelectField, TextAreaField } from '@/components/dashboard/Field'
import { Spinner, CardSkeleton, TableSkeleton } from '@/components/dashboard/Loaders'
import { EmptyState, ErrorState } from '@/components/dashboard/States'
import { StatCard } from '@/components/dashboard/StatCard'
import { useToast } from '@/components/dashboard/Toast'
import { api } from '@/lib/api'
import { formatDate } from '@/lib/date'
import type { PupilCreateInput, PupilGender, PupilStats, PupilView, SchoolClassView } from '@/types/portal'

interface GuardianRow {
  id: string
  fullName: string
  relationship: string
  phone: string
  email: string
  address: string
  isPrimary: boolean
  isEmergency: boolean
}

interface CreateForm {
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
  guardians: GuardianRow[]
}

let guardianSeq = 0
function newGuardian(): GuardianRow {
  guardianSeq += 1
  return {
    id: `guardian-${guardianSeq}`,
    fullName: '',
    relationship: '',
    phone: '',
    email: '',
    address: '',
    isPrimary: false,
    isEmergency: false,
  }
}

const emptyCreate: CreateForm = {
  pupilId: '',
  admissionNumber: '',
  firstName: '',
  middleName: '',
  lastName: '',
  dateOfBirth: '',
  gender: '',
  classId: '',
  dateAdmitted: '',
  address: '',
  guardians: [newGuardian()],
}

const PAGE_SIZE = 20

export function PupilManagementPage() {
  const { push } = useToast()
  const { user, hasPermission } = useAuth()

  const basePath = user?.roles.includes(OWNER_ROLE) ? '/owner' : '/headteacher'

  const [pupils, setPupils] = useState<PupilView[] | null>(null)
  const [stats, setStats] = useState<PupilStats | null>(null)
  const [classes, setClasses] = useState<SchoolClassView[]>([])
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [classFilter, setClassFilter] = useState('')
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [hasMore, setHasMore] = useState(false)

  const [createOpen, setCreateOpen] = useState(false)
  const [form, setForm] = useState<CreateForm>(emptyCreate)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)

  const debounceRef = useRef<number | null>(null)

  const can = {
    create: hasPermission('pupils.create'),
  }

  const loadPupils = useCallback(async () => {
    setError(null)
    try {
      const result = await api.listPupils({
        q: debouncedQuery || undefined,
        status: (statusFilter as 'ACTIVE' | 'INACTIVE' | undefined) || undefined,
        classId: classFilter || undefined,
        page,
        pageSize: PAGE_SIZE,
      })
      setPupils(result.items)
      setTotal(result.total)
      setHasMore(result.hasMore)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load pupils.')
    }
  }, [debouncedQuery, statusFilter, classFilter, page])

  const loadStats = useCallback(async () => {
    try {
      setStats(await api.pupilStats())
    } catch {
      setStats(null)
    }
  }, [])

  useEffect(() => {
    void loadPupils()
  }, [loadPupils])

  useEffect(() => {
    void loadStats()
  }, [loadStats])

  useEffect(() => {
    if (debounceRef.current !== null) window.clearTimeout(debounceRef.current)
    debounceRef.current = window.setTimeout(() => {
      setDebouncedQuery(query.trim())
      setPage(1)
    }, 350)
    return () => {
      if (debounceRef.current !== null) window.clearTimeout(debounceRef.current)
    }
  }, [query])

  useEffect(() => {
    let active = true
    api
      .listClasses()
      .then((list) => {
        if (active) setClasses(list)
      })
      .catch(() => {
        if (active) setClasses([])
      })
    return () => {
      active = false
    }
  }, [])

  const set = (field: Exclude<keyof CreateForm, 'guardians'>, value: string) => {
    setForm((current) => ({ ...current, [field]: value }))
    setFieldErrors((current) => {
      if (!current[field]) return current
      const next = { ...current }
      delete next[field]
      return next
    })
  }

  const setGuardian = (id: string, field: keyof GuardianRow, value: string | boolean) => {
    setForm((current) => ({
      ...current,
      guardians: current.guardians.map((guardian) =>
        guardian.id === id ? { ...guardian, [field]: value } : guardian,
      ),
    }))
    setFieldErrors((current) => {
      const next = { ...current }
      delete next[`guardians.${id}.${field}`]
      return next
    })
  }

  const addGuardian = () => {
    setForm((current) => ({ ...current, guardians: [...current.guardians, newGuardian()] }))
  }

  const removeGuardian = (id: string) => {
    setForm((current) => ({
      ...current,
      guardians: current.guardians.filter((guardian) => guardian.id !== id),
    }))
  }

  const openCreate = () => {
    setForm({ ...emptyCreate, guardians: [newGuardian()] })
    setFieldErrors({})
    setCreateOpen(true)
  }

  const handleCreate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
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
      setFieldErrors(errors)
      return
    }

    const payload: PupilCreateInput = {
      pupilId: form.pupilId.trim() || undefined,
      admissionNumber: form.admissionNumber.trim() || undefined,
      firstName: form.firstName.trim(),
      middleName: form.middleName.trim() || undefined,
      lastName: form.lastName.trim(),
      dateOfBirth: form.dateOfBirth,
      gender: form.gender as PupilGender,
      classId: form.classId,
      dateAdmitted: form.dateAdmitted || undefined,
      address: form.address.trim() || undefined,
      guardians: form.guardians.map((guardian) => ({
        fullName: guardian.fullName.trim(),
        relationship: guardian.relationship.trim(),
        phone: guardian.phone.trim() || undefined,
        email: guardian.email.trim() || undefined,
        address: guardian.address.trim() || undefined,
        isPrimary: guardian.isPrimary,
        isEmergency: guardian.isEmergency,
      })),
    }

    setSubmitting(true)
    try {
      const created = await api.createPupil(payload)
      push('success', `${created.fullName} registered successfully.`)
      setCreateOpen(false)
      await Promise.all([loadPupils(), loadStats()])
    } catch (err) {
      const apiError = err as { fieldErrors?: Record<string, string> }
      if (apiError.fieldErrors && Object.keys(apiError.fieldErrors).length > 0) {
        setFieldErrors(apiError.fieldErrors)
      } else {
        push('error', err instanceof Error ? err.message : 'Could not register the pupil.')
      }
    } finally {
      setSubmitting(false)
    }
  }

  const classOptions = classes
    .filter((klass) => klass.status === 'ACTIVE' || klass.id === form.classId)
    .map((klass) => ({ value: klass.id, label: klass.name }))

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const showSearch = Boolean(query || classFilter || statusFilter)

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Pupil Management"
        title="Pupils"
        description="Register and manage pupil records, class placements and parent or guardian contacts."
        actions={
          can.create ? (
            <Button onClick={openCreate}>
              <Plus className="h-4 w-4" aria-hidden="true" />
              Register Pupil
            </Button>
          ) : undefined
        }
      />

      {/* Statistics */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats ? (
          <>
            <StatCard
              label="Total Pupils"
              value={stats.total}
              hint={`${stats.active} active · ${stats.inactive} inactive`}
              icon={<Users className="h-5 w-5" aria-hidden="true" />}
              tone="royal"
            />
            <StatCard
              label="Active Pupils"
              value={stats.active}
              hint="Currently enrolled"
              icon={<GraduationCap className="h-5 w-5" aria-hidden="true" />}
              tone="green"
            />
            <StatCard
              label="Inactive Pupils"
              value={stats.inactive}
              hint="Left or suspended"
              icon={<UserPlus className="h-5 w-5" aria-hidden="true" />}
              tone="gold"
            />
            <StatCard
              label="Classes"
              value={classes.filter((klass) => klass.status === 'ACTIVE').length}
              hint="Active class levels"
              icon={<BookOpenCheck className="h-5 w-5" aria-hidden="true" />}
              tone="magenta"
            />
          </>
        ) : (
          Array.from({ length: 4 }).map((_, index) => <CardSkeleton key={index} />)
        )}
      </div>

      {/* Toolbar */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-col gap-3 md:flex-row md:items-center">
          <SelectField
            label=""
            name="classFilter"
            value={classFilter}
            onChange={(event) => {
              setClassFilter(event.target.value)
              setPage(1)
            }}
            options={classes.map((klass) => ({ value: klass.id, label: klass.name }))}
            placeholder="All classes"
            className="md:w-52"
            aria-label="Filter by class"
          />
          <SelectField
            label=""
            name="statusFilter"
            value={statusFilter}
            onChange={(event) => {
              setStatusFilter(event.target.value)
              setPage(1)
            }}
            options={[
              { value: 'ACTIVE', label: 'Active' },
              { value: 'INACTIVE', label: 'Inactive' },
            ]}
            placeholder="All statuses"
            className="md:w-44"
            aria-label="Filter by status"
          />
          <div className="relative w-full md:max-w-xs">
            <Search
              className="pointer-events-none absolute left-4 top-1/2 h-4.5 w-4.5 -translate-y-1/2 text-ink-500"
              aria-hidden="true"
            />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search name, ID or admission no…"
              aria-label="Search pupils"
              className="h-11 w-full rounded-xl border border-cream-300 bg-white pl-11 pr-4 text-sm text-ink-900 outline-none transition-colors placeholder:text-ink-500/60 focus:border-magenta-500"
            />
          </div>
        </div>
      </div>

      {/* Content */}
      {error ? (
        <ErrorState message={error} onRetry={() => void loadPupils()} />
      ) : pupils === null ? (
        <TableSkeleton rows={6} />
      ) : pupils.length === 0 ? (
        <EmptyState
          icon={<Users className="h-7 w-7" aria-hidden="true" />}
          title={showSearch ? 'No pupils match your filters.' : 'No pupils registered yet.'}
          description={
            showSearch
              ? 'Try adjusting your search or filters.'
              : 'Register a pupil to begin building your school records.'
          }
          action={
            can.create ? (
              <Button onClick={openCreate}>
                <Plus className="h-4 w-4" aria-hidden="true" />
                Register Pupil
              </Button>
            ) : undefined
          }
        />
      ) : (
        <>
          {/* Desktop table */}
          <Card className="hidden overflow-hidden md:block">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-cream-200 bg-cream-50 text-xs font-bold uppercase tracking-wider text-ink-500">
                  <tr>
                    <th scope="col" className="px-5 py-3.5">Pupil</th>
                    <th scope="col" className="px-5 py-3.5">Class</th>
                    <th scope="col" className="px-5 py-3.5">Admission No.</th>
                    <th scope="col" className="px-5 py-3.5">Date Admitted</th>
                    <th scope="col" className="px-5 py-3.5">Status</th>
                    <th scope="col" className="px-5 py-3.5 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-cream-200">
                  {pupils.map((pupil) => (
                    <tr key={pupil.id} className="transition-colors hover:bg-cream-50">
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <Avatar name={pupil.fullName} size="sm" />
                          <div className="min-w-0">
                            <p className="truncate font-bold text-ink-900">{pupil.fullName}</p>
                            <p className="truncate text-xs text-ink-500">{pupil.pupilId}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-ink-700">{pupil.className}</td>
                      <td className="px-5 py-3.5 text-ink-500">{pupil.admissionNumber ?? '—'}</td>
                      <td className="px-5 py-3.5 text-ink-500">{formatDate(pupil.dateAdmitted)}</td>
                      <td className="px-5 py-3.5"><StatusBadge status={pupil.status} /></td>
                      <td className="px-5 py-3.5 text-right">
                        <Button variant="soft" size="sm" to={`${basePath}/pupils/${pupil.id}`}>
                          View
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Mobile cards */}
          <ul className="space-y-3 md:hidden">
            {pupils.map((pupil) => (
              <li key={pupil.id}>
                <Card className="p-4">
                  <div className="flex items-center gap-3">
                    <Avatar name={pupil.fullName} size="md" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold text-ink-900">{pupil.fullName}</p>
                      <p className="truncate text-xs text-ink-500">
                        {pupil.pupilId} · {pupil.className}
                      </p>
                    </div>
                    <StatusBadge status={pupil.status} />
                  </div>
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-cream-200 pt-3">
                    <p className="text-xs text-ink-500">
                      Admitted {formatDate(pupil.dateAdmitted)}
                      {pupil.admissionNumber ? ` · ${pupil.admissionNumber}` : ''}
                    </p>
                    <Button variant="soft" size="sm" to={`${basePath}/pupils/${pupil.id}`}>
                      View profile
                    </Button>
                  </div>
                </Card>
              </li>
            ))}
          </ul>

          {/* Pagination */}
          {total > PAGE_SIZE ? (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-ink-500">
                Showing {((page - 1) * PAGE_SIZE) + 1}–{Math.min(page * PAGE_SIZE, total)} of {total} pupils
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPage((current) => Math.max(1, current - 1))}
                  disabled={page <= 1}
                  className="inline-flex items-center gap-1 rounded-full border border-cream-300 px-4 py-2 text-sm font-semibold text-ink-700 transition-colors hover:bg-cream-100 disabled:cursor-not-allowed disabled:opacity-50"
                  aria-label="Previous page"
                >
                  <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                  Prev
                </button>
                <span className="text-sm font-semibold text-ink-700">
                  Page {page} of {totalPages}
                </span>
                <button
                  type="button"
                  onClick={() => setPage((current) => current + 1)}
                  disabled={!hasMore}
                  className="inline-flex items-center gap-1 rounded-full border border-cream-300 px-4 py-2 text-sm font-semibold text-ink-700 transition-colors hover:bg-cream-100 disabled:cursor-not-allowed disabled:opacity-50"
                  aria-label="Next page"
                >
                  Next
                  <ChevronRight className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
            </div>
          ) : null}
        </>
      )}

      {/* Register pupil dialog */}
      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Register pupil"
        description="Register a new pupil with their class placement and guardian contacts."
        size="xl"
      >
        <form onSubmit={handleCreate} noValidate className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <p className="text-xs font-bold uppercase tracking-wider text-ink-500">Pupil details</p>
          </div>
          <TextField
            label="First name"
            name="firstName"
            value={form.firstName}
            onChange={(event) => set('firstName', event.target.value)}
            error={fieldErrors.firstName}
            required
          />
          <TextField
            label="Last name"
            name="lastName"
            value={form.lastName}
            onChange={(event) => set('lastName', event.target.value)}
            error={fieldErrors.lastName}
            required
          />
          <TextField
            label="Middle name"
            name="middleName"
            value={form.middleName}
            onChange={(event) => set('middleName', event.target.value)}
            error={fieldErrors.middleName}
          />
          <TextField
            label="Date of birth"
            name="dateOfBirth"
            type="date"
            value={form.dateOfBirth}
            onChange={(event) => set('dateOfBirth', event.target.value)}
            error={fieldErrors.dateOfBirth}
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
            error={fieldErrors.gender}
            required
          />
          <SelectField
            label="Class"
            name="classId"
            value={form.classId}
            onChange={(event) => set('classId', event.target.value)}
            options={classOptions}
            placeholder={classes.length > 0 ? 'Select a class' : 'No classes available yet'}
            error={fieldErrors.classId}
            required
          />
          <TextField
            label="Pupil ID"
            name="pupilId"
            value={form.pupilId}
            onChange={(event) => set('pupilId', event.target.value)}
            error={fieldErrors.pupilId}
            hint="Leave blank to auto-generate (PRPS-PUP-XXXX)."
            autoComplete="off"
          />
          <TextField
            label="Admission number"
            name="admissionNumber"
            value={form.admissionNumber}
            onChange={(event) => set('admissionNumber', event.target.value)}
            error={fieldErrors.admissionNumber}
            hint="School admission reference, if issued."
          />
          <TextField
            label="Date admitted"
            name="dateAdmitted"
            type="date"
            value={form.dateAdmitted}
            onChange={(event) => set('dateAdmitted', event.target.value)}
            error={fieldErrors.dateAdmitted}
          />
          <div className="sm:col-span-2">
            <TextAreaField
              label="Home address"
              name="address"
              value={form.address}
              onChange={(event) => set('address', event.target.value)}
              error={fieldErrors.address}
            />
          </div>

          <div className="sm:col-span-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold uppercase tracking-wider text-ink-500">Guardians</p>
              {form.guardians.length < 3 ? (
                <button
                  type="button"
                  onClick={addGuardian}
                  className="inline-flex items-center gap-1 text-sm font-semibold text-magenta-600 transition-colors hover:text-magenta-700"
                >
                  <Plus className="h-4 w-4" aria-hidden="true" />
                  Add guardian
                </button>
              ) : null}
            </div>
            {fieldErrors.guardians ? (
              <p role="alert" className="mt-1.5 text-xs font-medium text-red-600">
                {fieldErrors.guardians}
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
                  error={fieldErrors[`guardians.${guardian.id}.fullName`]}
                  required
                />
                <TextField
                  label="Relationship"
                  name={`guardian-${guardian.id}-relationship`}
                  value={guardian.relationship}
                  onChange={(event) => setGuardian(guardian.id, 'relationship', event.target.value)}
                  error={fieldErrors[`guardians.${guardian.id}.relationship`]}
                  placeholder="e.g. Parent, Guardian"
                  required
                />
                <TextField
                  label="Phone"
                  name={`guardian-${guardian.id}-phone`}
                  type="tel"
                  value={guardian.phone}
                  onChange={(event) => setGuardian(guardian.id, 'phone', event.target.value)}
                  error={fieldErrors[`guardians.${guardian.id}.phone`]}
                />
                <TextField
                  label="Email"
                  name={`guardian-${guardian.id}-email`}
                  type="email"
                  value={guardian.email}
                  onChange={(event) => setGuardian(guardian.id, 'email', event.target.value)}
                  error={fieldErrors[`guardians.${guardian.id}.email`]}
                />
                <div className="sm:col-span-2">
                  <TextField
                    label="Address"
                    name={`guardian-${guardian.id}-address`}
                    value={guardian.address}
                    onChange={(event) => setGuardian(guardian.id, 'address', event.target.value)}
                    error={fieldErrors[`guardians.${guardian.id}.address`]}
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

          <div className="flex flex-wrap items-center justify-end gap-2 sm:col-span-2">
            <Button variant="cream" type="button" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? <Spinner className="h-4 w-4" /> : <Plus className="h-4 w-4" aria-hidden="true" />}
              Register pupil
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}