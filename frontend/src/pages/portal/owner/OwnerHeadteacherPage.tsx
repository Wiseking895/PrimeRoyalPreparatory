import { useCallback, useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { MessageSquareWarning, Plus, ShieldCheck, UserCog } from 'lucide-react'
import { PageHeader } from '@/components/dashboard/PageHeader'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Avatar } from '@/components/dashboard/Avatar'
import { StatusBadge, Badge } from '@/components/dashboard/Badge'
import { Modal } from '@/components/dashboard/Modal'
import { TextField, SelectField } from '@/components/dashboard/Field'
import { Spinner, TableSkeleton } from '@/components/dashboard/Loaders'
import { EmptyState, ErrorState } from '@/components/dashboard/States'
import { ConfirmDialog } from '@/components/dashboard/ConfirmDialog'
import { useToast } from '@/components/dashboard/Toast'
import { api } from '@/lib/api'
import type { StaffView } from '@/types/portal'

interface FormState {
  firstName: string
  lastName: string
  email: string
  phone: string
  address: string
  password: string
  confirmPassword: string
  status: 'ACTIVE' | 'INACTIVE'
}

const emptyForm: FormState = {
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  address: '',
  password: '',
  confirmPassword: '',
  status: 'ACTIVE',
}

export function OwnerHeadteacherPage() {
  const { push } = useToast()
  const [headteachers, setHeadteachers] = useState<StaffView[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [form, setForm] = useState<FormState>(emptyForm)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)
  const [confirmTarget, setConfirmTarget] = useState<StaffView | null>(null)
  const [confirmStatus, setConfirmStatus] = useState<'ACTIVE' | 'INACTIVE'>('INACTIVE')
  const [actionLoading, setActionLoading] = useState(false)

  const load = useCallback(async () => {
    setError(null)
    try {
      setHeadteachers(await api.listHeadteachers())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load Headteacher accounts.')
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const hasActive = headteachers?.some((entry) => entry.status === 'ACTIVE') ?? false

  const set = (field: keyof FormState, value: string | 'ACTIVE' | 'INACTIVE') => {
    setForm((current) => ({ ...current, [field]: value }))
    setFieldErrors((current) => {
      if (!current[field]) return current
      const next = { ...current }
      delete next[field]
      return next
    })
  }

  const openCreate = () => {
    setForm(emptyForm)
    setFieldErrors({})
    setCreateOpen(true)
  }

  const handleCreate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setFieldErrors({})
    const errors: Record<string, string> = {}
    if (form.firstName.trim().length < 2) errors.firstName = 'First name must be at least 2 characters.'
    if (form.lastName.trim().length < 2) errors.lastName = 'Last name must be at least 2 characters.'
    if (!/^\S+@\S+\.\S+$/.test(form.email.trim())) errors.email = 'Enter a valid email address.'
    if (form.password.length < 8) errors.password = 'Password must be at least 8 characters.'
    if (form.password !== form.confirmPassword) errors.confirmPassword = 'Passwords do not match.'
    if ((form.password.match(/[A-Za-z]/) && !form.password.match(/[0-9]/)) || (!form.password.match(/[A-Za-z]/) && form.password.match(/[0-9]/))) {
      errors.password = 'Password must include letters and numbers.'
    }
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors)
      return
    }

    setSubmitting(true)
    try {
      await api.createHeadteacher({
        firstName: form.firstName,
        lastName: form.lastName,
        email: form.email,
        phone: form.phone || undefined,
        address: form.address || undefined,
        password: form.password,
        confirmPassword: form.confirmPassword,
        status: form.status,
      })
      push('success', 'Headteacher account created successfully.')
      setCreateOpen(false)
      await load()
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

  const handleStatusToggle = async () => {
    if (!confirmTarget) return
    setActionLoading(true)
    try {
      await api.setHeadteacherStatus(confirmTarget.id, confirmStatus)
      push('success', confirmStatus === 'ACTIVE' ? 'Headteacher activated.' : 'Headteacher deactivated.')
      setConfirmTarget(null)
      await load()
    } catch (err) {
      push('error', err instanceof Error ? err.message : 'Could not update the account.')
    } finally {
      setActionLoading(false)
    }
  }

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Owner"
        title="Headteacher Management"
        description="Create and manage the overall Headteacher account. Only one active Headteacher may exist at a time."
        actions={
          <Button onClick={openCreate} disabled={hasActive}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            Create Headteacher
          </Button>
        }
      />

      {hasActive ? (
        <p className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3.5 text-sm leading-relaxed text-amber-800">
          <MessageSquareWarning className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          An active Headteacher already exists. Deactivate the current Headteacher before creating a
          replacement.
        </p>
      ) : null}

      {error ? (
        <ErrorState message={error} onRetry={() => void load()} />
      ) : headteachers === null ? (
        <TableSkeleton rows={4} />
      ) : headteachers.length === 0 ? (
        <EmptyState
          icon={<UserCog className="h-7 w-7" aria-hidden="true" />}
          title="No Headteacher account has been created yet."
          description="Create the overall Headteacher account to hand over day-to-day school operations."
          action={
            <Button onClick={openCreate}>
              <Plus className="h-4 w-4" aria-hidden="true" />
              Create Headteacher
            </Button>
          }
        />
      ) : (
        <div className="space-y-4">
          {headteachers.map((entry) => (
            <Card key={entry.id} className="p-5">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                <Avatar name={entry.fullName} size="lg" />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-base font-bold text-ink-900">{entry.fullName}</p>
                    <StatusBadge status={entry.status} />
                  </div>
                  <p className="mt-0.5 truncate text-sm text-ink-500">
                    {entry.staffId} · {entry.email}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Badge tone="royal">
                      <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
                      {entry.permissions.length} permissions
                    </Badge>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Button to={`/owner/headteacher/${entry.id}`} variant="soft" size="sm">
                    Manage account
                  </Button>
                  <Button to={`/owner/headteacher/${entry.id}?tab=permissions`} variant="outline" size="sm">
                    Permissions
                  </Button>
                  {entry.status === 'ACTIVE' ? (
                    <Button
                      variant="cream"
                      size="sm"
                      onClick={() => {
                        setConfirmTarget(entry)
                        setConfirmStatus('INACTIVE')
                      }}
                    >
                      Deactivate
                    </Button>
                  ) : (
                    <Button
                      variant="cream"
                      size="sm"
                      onClick={() => {
                        setConfirmTarget(entry)
                        setConfirmStatus('ACTIVE')
                      }}
                    >
                      Activate
                    </Button>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Create dialog */}
      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Create Headteacher account"
        description="The Headteacher is the overall operational administrator of the school platform."
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
            label="Account status"
            name="status"
            value={form.status}
            onChange={(event) => set('status', event.target.value as 'ACTIVE' | 'INACTIVE')}
            options={[
              { value: 'ACTIVE', label: 'Active — can sign in immediately' },
              { value: 'INACTIVE', label: 'Inactive — hold until ready' },
            ]}
          />
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
              {submitting ? <Spinner className="h-4 w-4" /> : null}
              Create account
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={confirmTarget !== null}
        title={confirmStatus === 'ACTIVE' ? 'Activate Headteacher' : 'Deactivate Headteacher'}
        message={
          confirmStatus === 'ACTIVE' ? (
            <>
              Activate <strong>{confirmTarget?.fullName}</strong>? The account will regain access to the
              staff portal immediately.
            </>
          ) : (
            <>
              Deactivate <strong>{confirmTarget?.fullName}</strong>? The account will lose access to the staff
              portal until it is reactivated.
            </>
          )
        }
        confirmLabel={confirmStatus === 'ACTIVE' ? 'Activate' : 'Deactivate'}
        loading={actionLoading}
        onConfirm={() => void handleStatusToggle()}
        onCancel={() => setConfirmTarget(null)}
      />
    </div>
  )
}