import { useCallback, useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { BookOpen, Building2, Plus, Search, UserRound, Users } from 'lucide-react'
import { useSearchParams } from 'react-router-dom'
import { OWNER_ROLE, STAFF_POSITIONS, staffPositionByKey } from '@/auth/roles'
import { useAuth } from '@/auth/AuthContext'
import { PageHeader } from '@/components/dashboard/PageHeader'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Avatar } from '@/components/dashboard/Avatar'
import { StatusBadge, Badge } from '@/components/dashboard/Badge'
import { InvitationBadge } from '@/components/dashboard/InvitationBadge'
import { Modal } from '@/components/dashboard/Modal'
import { TextField, SelectField } from '@/components/dashboard/Field'
import { Spinner, TableSkeleton, CardSkeleton } from '@/components/dashboard/Loaders'
import { EmptyState, ErrorState } from '@/components/dashboard/States'
import { StatCard } from '@/components/dashboard/StatCard'
import { useToast } from '@/components/dashboard/Toast'
import { api } from '@/lib/api'
import { invitationFeedback } from '@/lib/invitation'
import type { CreateStaffResult, StaffStats, StaffView } from '@/types/portal'
import { cn } from '@/lib/cn'

type Filter = 'ALL' | 'TEACHING' | 'NON_TEACHING'

interface CreateForm {
  firstName: string
  lastName: string
  email: string
  phone: string
  address: string
  category: string
  position: string
}

const emptyCreate: CreateForm = {
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  address: '',
  category: '',
  position: '',
}

export function StaffManagementPage() {
  const { push } = useToast()
  const { user, hasPermission } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const rawFilter = searchParams.get('filter')
  const filter: Filter =
    rawFilter === 'TEACHING' || rawFilter === 'NON_TEACHING' ? rawFilter : 'ALL'

  const basePath = user?.roles.includes(OWNER_ROLE) ? '/owner' : '/headteacher'

  const [staff, setStaff] = useState<StaffView[] | null>(null)
  const [stats, setStats] = useState<StaffStats | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [positionFilter, setPositionFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')

  const [createOpen, setCreateOpen] = useState(false)
  const [form, setForm] = useState<CreateForm>(emptyCreate)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)
  const [createResult, setCreateResult] = useState<CreateStaffResult | null>(null)

  const debounceRef = useRef<number | null>(null)

  const can = {
    create: hasPermission('staff.create'),
    update: hasPermission('staff.update'),
    assignRole: hasPermission('staff.assign_role'),
    removeRole: hasPermission('staff.remove_role'),
  }

  const loadStaff = useCallback(async () => {
    setError(null)
    try {
      const list = await api.listStaff({
        q: debouncedQuery || undefined,
        category: filter === 'ALL' ? undefined : filter,
        position: positionFilter || undefined,
        status: (statusFilter as 'ACTIVE' | 'INACTIVE' | undefined) || undefined,
      })
      setStaff(list)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load staff.')
    }
  }, [debouncedQuery, filter, positionFilter, statusFilter])

  const loadStats = useCallback(async () => {
    try {
      setStats(await api.staffStats())
    } catch {
      setStats(null)
    }
  }, [])

  useEffect(() => {
    void loadStaff()
  }, [loadStaff])

  useEffect(() => {
    void loadStats()
  }, [loadStats])

  useEffect(() => {
    if (debounceRef.current !== null) window.clearTimeout(debounceRef.current)
    debounceRef.current = window.setTimeout(() => setDebouncedQuery(query.trim()), 350)
    return () => {
      if (debounceRef.current !== null) window.clearTimeout(debounceRef.current)
    }
  }, [query])

  const setFilter = (next: Filter) => {
    if (next === 'ALL') {
      searchParams.delete('filter')
    } else {
      searchParams.set('filter', next)
    }
    setSearchParams(searchParams, { replace: true })
  }

  const positionOptions = STAFF_POSITIONS.filter(
    (position) => !form.category || position.category === form.category,
  ).map((position) => ({ value: position.key, label: position.label }))

  const set = (field: keyof CreateForm, value: string) => {
    setForm((current) => {
      const next = { ...current, [field]: value }
      if (field === 'category') next.position = ''
      return next
    })
    setFieldErrors((current) => {
      if (!current[field]) return current
      const next = { ...current }
      delete next[field]
      if (field === 'category') delete next.position
      return next
    })
  }

  const openCreate = () => {
    setForm(emptyCreate)
    setFieldErrors({})
    setCreateResult(null)
    setCreateOpen(true)
  }

  const handleCreate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const errors: Record<string, string> = {}
    if (form.firstName.trim().length < 2) errors.firstName = 'First name must be at least 2 characters.'
    if (form.lastName.trim().length < 2) errors.lastName = 'Last name must be at least 2 characters.'
    if (!/^\S+@\S+\.\S+$/.test(form.email.trim())) errors.email = 'Enter a valid email address.'
    if (!form.category) errors.category = 'Select a staff category.'
    if (!form.position) errors.position = 'Select a staff position.'
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors)
      return
    }

    setSubmitting(true)
    try {
      const result = await api.createStaff({
        firstName: form.firstName,
        lastName: form.lastName,
        email: form.email,
        phone: form.phone || undefined,
        address: form.address || undefined,
        position: form.position,
      })
      const feedback = invitationFeedback(result.invitation, 'create', 'staff')
      push(feedback.tone, feedback.message)
      setCreateResult(result)
      await Promise.all([loadStaff(), loadStats()])
    } catch (err) {
      if (err instanceof Error) {
        const apiError = err as { fieldErrors?: Record<string, string> }
        if (apiError.fieldErrors && Object.keys(apiError.fieldErrors).length > 0) {
          setFieldErrors(apiError.fieldErrors)
        } else {
          push('error', err.message)
        }
      }
    } finally {
      setSubmitting(false)
    }
  }

  const handleClose = () => {
    setCreateOpen(false)
    setCreateResult(null)
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Staff Management"
        title="Staff"
        description="Teaching and non-teaching staff accounts. Staff are invited with a temporary password and must set their own on first sign-in."
        actions={
          can.create ? (
            <Button onClick={openCreate}>
              <Plus className="h-4 w-4" aria-hidden="true" />
              Add Staff
            </Button>
          ) : undefined
        }
      />

      {/* Statistics */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats ? (
          <>
            <StatCard
              label="Total Staff"
              value={stats.total}
              hint={`${stats.active} active · ${stats.inactive} inactive`}
              icon={<Users className="h-5 w-5" aria-hidden="true" />}
              tone="royal"
            />
            <StatCard
              label="Teaching Staff"
              value={stats.teaching}
              hint="Class & subject teachers"
              icon={<BookOpen className="h-5 w-5" aria-hidden="true" />}
              tone="magenta"
            />
            <StatCard
              label="Non-Teaching Staff"
              value={stats.nonTeaching}
              hint="Administration & support"
              icon={<Building2 className="h-5 w-5" aria-hidden="true" />}
              tone="gold"
            />
            <StatCard
              label="Active Accounts"
              value={stats.active}
              hint={stats.inactive > 0 ? `${stats.inactive} inactive account(s)` : 'All accounts active'}
              icon={<UserRound className="h-5 w-5" aria-hidden="true" />}
              tone="green"
            />
          </>
        ) : (
          Array.from({ length: 4 }).map((_, index) => <CardSkeleton key={index} />)
        )}
      </div>

      {/* Toolbar */}
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex rounded-xl bg-cream-200/70 p-1" role="tablist" aria-label="Filter staff by category">
          {(
            [
              { key: 'ALL', label: 'All' },
              { key: 'TEACHING', label: 'Teaching' },
              { key: 'NON_TEACHING', label: 'Non-Teaching' },
            ] as const
          ).map((tab) => (
            <button
              key={tab.key}
              type="button"
              role="tab"
              aria-selected={filter === tab.key}
              onClick={() => setFilter(tab.key)}
              className={cn(
                'flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold transition-colors',
                filter === tab.key ? 'bg-white text-magenta-600 shadow-sm' : 'text-ink-500 hover:text-ink-900',
              )}
            >
              {tab.key === 'TEACHING' ? <BookOpen className="h-4 w-4" aria-hidden="true" /> : null}
              {tab.key === 'NON_TEACHING' ? <Building2 className="h-4 w-4" aria-hidden="true" /> : null}
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex flex-col gap-3 md:flex-row md:items-center">
          <SelectField
            label=""
            name="positionFilter"
            value={positionFilter}
            onChange={(event) => setPositionFilter(event.target.value)}
            options={STAFF_POSITIONS.map((position) => ({ value: position.key, label: position.label }))}
            placeholder="All positions"
            className="md:w-52"
            aria-label="Filter by position"
          />
          <SelectField
            label=""
            name="statusFilter"
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            options={[
              { value: 'ACTIVE', label: 'Active' },
              { value: 'INACTIVE', label: 'Inactive' },
            ]}
            placeholder="All statuses"
            className="md:w-44"
            aria-label="Filter by status"
          />
          <div className="relative w-full md:max-w-xs">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4.5 w-4.5 -translate-y-1/2 text-ink-500" aria-hidden="true" />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search name, email or staff ID…"
              aria-label="Search staff"
              className="h-11 w-full rounded-xl border border-cream-300 bg-white pl-11 pr-4 text-sm text-ink-900 outline-none transition-colors placeholder:text-ink-500/60 focus:border-magenta-500"
            />
          </div>
        </div>
      </div>

      {/* Content */}
      {error ? (
        <ErrorState message={error} onRetry={() => void loadStaff()} />
      ) : staff === null ? (
        <TableSkeleton rows={6} />
      ) : staff.length === 0 ? (
        <EmptyState
          icon={<Users className="h-7 w-7" aria-hidden="true" />}
          title={
            debouncedQuery || positionFilter || statusFilter
              ? 'No staff match your filters.'
              : 'No staff members found yet.'
          }
          description={
            debouncedQuery || positionFilter || statusFilter
              ? 'Try adjusting your search or filters.'
              : 'Add a staff account to begin building your team.'
          }
          action={
            can.create ? (
              <Button onClick={openCreate}>
                <Plus className="h-4 w-4" aria-hidden="true" />
                Add Staff
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
                    <th scope="col" className="px-5 py-3.5">Staff</th>
                    <th scope="col" className="px-5 py-3.5">Type</th>
                    <th scope="col" className="px-5 py-3.5">Position</th>
                    <th scope="col" className="px-5 py-3.5">Role</th>
                    <th scope="col" className="px-5 py-3.5">Status</th>
                    <th scope="col" className="px-5 py-3.5 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-cream-200">
                  {staff.map((entry) => (
                    <tr key={entry.id} className="transition-colors hover:bg-cream-50">
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <Avatar name={entry.fullName} size="sm" />
                          <div className="min-w-0">
                            <p className="truncate font-bold text-ink-900">{entry.fullName}</p>
                            <p className="truncate text-xs text-ink-500">{entry.staffId} · {entry.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3.5">
                        <Badge tone={entry.category === 'TEACHING' ? 'magenta' : 'royal'}>
                          {entry.category?.replace('_', ' ') ?? 'Staff'}
                        </Badge>
                      </td>
                      <td className="px-5 py-3.5 text-ink-700">
                        {staffPositionByKey(entry.position)?.label ?? entry.position ?? '—'}
                      </td>
                      <td className="px-5 py-3.5 text-ink-500">{entry.roles.join(', ') || '—'}</td>
                      <td className="px-5 py-3.5"><StatusBadge status={entry.status} /></td>
                      <td className="px-5 py-3.5 text-right">
                        <Button variant="soft" size="sm" to={`${basePath}/staff/${entry.id}`}>
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
            {staff.map((entry) => (
              <li key={entry.id}>
                <Card className="p-4">
                  <div className="flex items-center gap-3">
                    <Avatar name={entry.fullName} size="md" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold text-ink-900">{entry.fullName}</p>
                      <p className="truncate text-xs text-ink-500">
                        {entry.staffId} · {staffPositionByKey(entry.position)?.label ?? entry.position ?? 'No position'}
                      </p>
                    </div>
                    <StatusBadge status={entry.status} />
                  </div>
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-cream-200 pt-3">
                    <div className="flex flex-wrap gap-1.5">
                      <Badge tone={entry.category === 'TEACHING' ? 'magenta' : 'royal'}>
                        {entry.category?.replace('_', ' ') ?? 'Staff'}
                      </Badge>
                      {entry.mustChangePassword ? <Badge tone="amber">Awaiting password change</Badge> : null}
                    </div>
                    <Button variant="soft" size="sm" to={`${basePath}/staff/${entry.id}`}>
                      View profile
                    </Button>
                  </div>
                </Card>
              </li>
            ))}
          </ul>
        </>
      )}

      {/* Create staff dialog */}
      <Modal
        open={createOpen}
        onClose={handleClose}
        title={createResult ? 'Invitation sent' : 'Add staff account'}
        description={
          createResult
            ? undefined
            : 'Create a teaching or non-teaching staff account. An invitation with a temporary password is emailed automatically.'
        }
        size="lg"
      >
        {createResult ? (
          <div className="space-y-5">
            <div className="flex items-center gap-4">
              <Avatar name={createResult.staff.fullName} size="lg" />
              <div className="min-w-0 flex-1">
                <p className="text-lg font-bold text-ink-900">{createResult.staff.fullName}</p>
                <p className="mt-0.5 text-sm text-ink-500">
                  {createResult.staff.staffId} · {createResult.staff.email}
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Badge tone={createResult.staff.category === 'TEACHING' ? 'magenta' : 'royal'}>
                    {createResult.staff.category?.replace('_', ' ') ?? 'Staff'}
                  </Badge>
                  <Badge tone="green">
                    {staffPositionByKey(createResult.staff.position)?.label ?? createResult.staff.position}
                  </Badge>
                  <InvitationBadge invitation={createResult.invitation} />
                </div>
              </div>
            </div>
            <p className="rounded-xl border border-cream-200 bg-cream-50 p-4 text-sm leading-relaxed text-ink-700">
              {invitationFeedback(createResult.invitation, 'create', 'staff').message}
            </p>
            <div className="flex flex-wrap justify-end gap-2">
              <Button variant="cream" onClick={openCreate}>
                <Plus className="h-4 w-4" aria-hidden="true" />
                Add another
              </Button>
              <Button onClick={handleClose}>Done</Button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleCreate} noValidate className="grid gap-4 sm:grid-cols-2">
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
            <div className="sm:col-span-2">
              <TextField
                label="Email"
                name="email"
                type="email"
                autoComplete="email"
                value={form.email}
                onChange={(event) => set('email', event.target.value)}
                error={fieldErrors.email}
                hint="The invitation with the temporary password is sent to this address."
                required
              />
            </div>
            <TextField
              label="Phone"
              name="phone"
              value={form.phone}
              onChange={(event) => set('phone', event.target.value)}
              error={fieldErrors.phone}
            />
            <SelectField
              label="Category"
              name="category"
              value={form.category}
              onChange={(event) => set('category', event.target.value)}
              options={[
                { value: 'TEACHING', label: 'Teaching' },
                { value: 'NON_TEACHING', label: 'Non-Teaching' },
              ]}
              placeholder="Select a category"
              error={fieldErrors.category}
              required
            />
            <div className="sm:col-span-2">
              <SelectField
                label="Position"
                name="position"
                value={form.position}
                onChange={(event) => set('position', event.target.value)}
                options={positionOptions}
                placeholder={form.category ? 'Select a position' : 'Choose a category first'}
                error={fieldErrors.position}
                required
              />
            </div>
            <div className="sm:col-span-2">
              <TextField
                label="Address"
                name="address"
                value={form.address}
                onChange={(event) => set('address', event.target.value)}
                error={fieldErrors.address}
              />
            </div>
            <div className="flex items-center justify-end gap-2 sm:col-span-2">
              <Button variant="cream" type="button" onClick={handleClose}>
                Cancel
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? <Spinner className="h-4 w-4" /> : <Plus className="h-4 w-4" aria-hidden="true" />}
                Create & invite
              </Button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  )
}