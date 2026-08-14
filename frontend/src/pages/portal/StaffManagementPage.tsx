import { useCallback, useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { BookOpen, Building2, Plus, Search, Users } from 'lucide-react'
import { useSearchParams } from 'react-router-dom'
import { ASSIGNABLE_STAFF_ROLES } from '@/auth/roles'
import { useAuth } from '@/auth/AuthContext'
import { PageHeader } from '@/components/dashboard/PageHeader'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Avatar } from '@/components/dashboard/Avatar'
import { StatusBadge, Badge } from '@/components/dashboard/Badge'
import { Modal } from '@/components/dashboard/Modal'
import { TextField, SelectField } from '@/components/dashboard/Field'
import { Spinner, TableSkeleton } from '@/components/dashboard/Loaders'
import { EmptyState, ErrorState } from '@/components/dashboard/States'
import { StaffProfileModal } from '@/components/dashboard/StaffProfileModal'
import { useToast } from '@/components/dashboard/Toast'
import { api } from '@/lib/api'
import type { RoleDefinition, StaffView } from '@/types/portal'
import { cn } from '@/lib/cn'

type Filter = 'ALL' | 'TEACHING' | 'NON_TEACHING'

interface CreateForm {
  firstName: string
  lastName: string
  email: string
  phone: string
  address: string
  roleName: string
  category: string
  password: string
  confirmPassword: string
}

const emptyCreate: CreateForm = {
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  address: '',
  roleName: '',
  category: '',
  password: '',
  confirmPassword: '',
}

export function StaffManagementPage() {
  const { push } = useToast()
  const { user, hasPermission } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const rawFilter = searchParams.get('filter')
  const filter: Filter =
    rawFilter === 'TEACHING' || rawFilter === 'NON_TEACHING' ? rawFilter : 'ALL'

  const [staff, setStaff] = useState<StaffView[] | null>(null)
  const [roles, setRoles] = useState<RoleDefinition[]>([])
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')

  const [createOpen, setCreateOpen] = useState(false)
  const [form, setForm] = useState<CreateForm>(emptyCreate)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)

  const [profileId, setProfileId] = useState<string | null>(null)

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
      setStaff(await api.listStaff(debouncedQuery || undefined))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load staff.')
    }
  }, [debouncedQuery])

  useEffect(() => {
    void loadStaff()
  }, [loadStaff])

  useEffect(() => {
    void api
      .listRoles()
      .then((roleDefinitions) =>
        setRoles(roleDefinitions.filter((role) => ASSIGNABLE_STAFF_ROLES.includes(role.name))),
      )
      .catch(() => {
        setRoles([])
      })
  }, [])

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

  const visible = staff?.filter((entry) => (filter === 'ALL' ? true : entry.category === filter)) ?? []
  const profileStaff = staff?.find((entry) => entry.id === profileId) ?? null
  const selectedRoleLabel = roles.find((role) => role.name === form.roleName)?.label ?? ''

  const set = (field: keyof CreateForm, value: string) => {
    setForm((current) => ({ ...current, [field]: value }))
    setFieldErrors((current) => {
      if (!current[field]) return current
      const next = { ...current }
      delete next[field]
      return next
    })
  }

  const handleCreate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const errors: Record<string, string> = {}
    if (form.firstName.trim().length < 2) errors.firstName = 'First name must be at least 2 characters.'
    if (form.lastName.trim().length < 2) errors.lastName = 'Last name must be at least 2 characters.'
    if (!/^\S+@\S+\.\S+$/.test(form.email.trim())) errors.email = 'Enter a valid email address.'
    if (form.password.length < 8) errors.password = 'Password must be at least 8 characters.'
    if (form.password !== form.confirmPassword) errors.confirmPassword = 'Passwords do not match.'
    if (!/^[A-Za-z]+[0-9]|[0-9]+[A-Za-z]/.test(form.password)) {
      errors.password = 'Password must include letters and numbers.'
    }
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors)
      return
    }

    setSubmitting(true)
    try {
      await api.createStaff({
        firstName: form.firstName,
        lastName: form.lastName,
        email: form.email,
        phone: form.phone || undefined,
        address: form.address || undefined,
        roleName: form.roleName || undefined,
        category: (form.category as 'TEACHING' | 'NON_TEACHING') || undefined,
        password: form.password,
        confirmPassword: form.confirmPassword,
      })
      push('success', 'Staff account created successfully.')
      setCreateOpen(false)
      setForm(emptyCreate)
      await loadStaff()
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

  const handleStaffUpdated = (updated: StaffView) => {
    setStaff((current) =>
      current ? current.map((entry) => (entry.id === updated.id ? updated : entry)) : current,
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Staff Management"
        title="Staff"
        description="Teaching and non-teaching staff accounts. Staff are created and managed here — later phases add classes, subjects and academic scope."
        actions={
          can.create ? (
            <Button onClick={() => { setForm(emptyCreate); setFieldErrors({}); setCreateOpen(true) }}>
              <Plus className="h-4 w-4" aria-hidden="true" />
              Add Staff
            </Button>
          ) : undefined
        }
      />

      {/* Toolbar */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex rounded-xl bg-cream-200/70 p-1" role="tablist" aria-label="Filter staff">
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

        <div className="relative w-full md:max-w-xs">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4.5 w-4.5 -translate-y-1/2 text-ink-500" aria-hidden="true" />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search name, email or staff ID…"
            className="h-11 w-full rounded-xl border border-cream-300 bg-white pl-11 pr-4 text-sm text-ink-900 outline-none transition-colors placeholder:text-ink-500/60 focus:border-magenta-500"
          />
        </div>
      </div>

      {/* Content */}
      {error ? (
        <ErrorState message={error} onRetry={() => void loadStaff()} />
      ) : staff === null ? (
        <TableSkeleton rows={6} />
      ) : visible.length === 0 ? (
        <EmptyState
          icon={<Users className="h-7 w-7" aria-hidden="true" />}
          title={debouncedQuery ? 'No staff match your search.' : `No ${filter === 'ALL' ? '' : `${filter.replace('_', ' ').toLowerCase()} `}staff members found.`}
          description={
            debouncedQuery
              ? 'Try a different name, email or staff ID.'
              : 'Add a staff account to begin building your team.'
          }
          action={
            can.create ? (
              <Button onClick={() => { setForm(emptyCreate); setFieldErrors({}); setCreateOpen(true) }}>
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
                    <th scope="col" className="px-5 py-3.5">Role</th>
                    <th scope="col" className="px-5 py-3.5">Contact</th>
                    <th scope="col" className="px-5 py-3.5">Status</th>
                    <th scope="col" className="px-5 py-3.5 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-cream-200">
                  {visible.map((entry) => (
                    <tr key={entry.id} className="transition-colors hover:bg-cream-50">
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <Avatar name={entry.fullName} size="sm" />
                          <div>
                            <p className="font-bold text-ink-900">{entry.fullName}</p>
                            <p className="text-xs text-ink-500">{entry.staffId}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3.5">
                        <Badge tone={entry.category === 'TEACHING' ? 'magenta' : 'royal'}>
                          {entry.category?.replace('_', ' ') ?? 'Staff'}
                        </Badge>
                      </td>
                      <td className="px-5 py-3.5 text-ink-700">{entry.roles.join(', ') || '—'}</td>
                      <td className="px-5 py-3.5 text-ink-500">{entry.email}</td>
                      <td className="px-5 py-3.5"><StatusBadge status={entry.status} /></td>
                      <td className="px-5 py-3.5 text-right">
                        <Button variant="soft" size="sm" onClick={() => setProfileId(entry.id)}>
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
            {visible.map((entry) => (
              <li key={entry.id}>
                <Card className="p-4">
                  <div className="flex items-center gap-3">
                    <Avatar name={entry.fullName} size="md" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold text-ink-900">{entry.fullName}</p>
                      <p className="truncate text-xs text-ink-500">{entry.staffId} · {entry.roles.join(', ') || 'No role'}</p>
                    </div>
                    <StatusBadge status={entry.status} />
                  </div>
                  <div className="mt-3 flex items-center justify-between gap-2 border-t border-cream-200 pt-3">
                    <Badge tone={entry.category === 'TEACHING' ? 'magenta' : 'royal'}>
                      {entry.category?.replace('_', ' ') ?? 'Staff'}
                    </Badge>
                    <Button variant="soft" size="sm" onClick={() => setProfileId(entry.id)}>
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
        onClose={() => setCreateOpen(false)}
        title="Add staff account"
        description="Create a teaching or non-teaching staff account with a role."
        size="lg"
      >
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
            placeholder="Derive from role…"
          />
          <div className="sm:col-span-2">
            <SelectField
              label="Role"
              name="roleName"
              value={form.roleName}
              onChange={(event) => set('roleName', event.target.value)}
              options={roles.map((role) => ({ value: role.name, label: role.label }))}
              placeholder={roles.length > 0 ? 'Select a role (optional)' : 'No assignable roles available'}
            />
            {form.roleName ? (
              <p className="mt-1.5 text-xs text-ink-500">Role: {selectedRoleLabel}</p>
            ) : null}
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
          <TextField
            label="Temporary password"
            name="password"
            type="password"
            autoComplete="new-password"
            value={form.password}
            onChange={(event) => set('password', event.target.value)}
            error={fieldErrors.password}
            hint="At least 8 characters, including a letter and a number."
            required
          />
          <TextField
            label="Confirm password"
            name="confirmPassword"
            type="password"
            autoComplete="new-password"
            value={form.confirmPassword}
            onChange={(event) => set('confirmPassword', event.target.value)}
            error={fieldErrors.confirmPassword}
            required
          />
          <div className="flex items-center justify-end gap-2 sm:col-span-2">
            <Button variant="cream" type="button" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? <Spinner className="h-4 w-4" /> : <Plus className="h-4 w-4" aria-hidden="true" />}
              Create account
            </Button>
          </div>
        </form>
      </Modal>

      {/* Staff profile */}
      <StaffProfileModal
        staff={profileStaff}
        isSelf={profileStaff?.id === user?.id}
        roles={roles}
        can={can}
        onClose={() => setProfileId(null)}
        onUpdated={handleStaffUpdated}
        onToast={(tone, message) => push(tone, message)}
      />
    </div>
  )
}