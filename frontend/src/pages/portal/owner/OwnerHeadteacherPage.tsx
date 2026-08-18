import { useCallback, useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import {
  CheckCircle2,
  MailX,
  MessageSquareWarning,
  Plus,
  RefreshCw,
  ShieldCheck,
  UserCog,
} from 'lucide-react'
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
import { invitationFeedback } from '@/lib/invitation'
import type { CreateHeadteacherResult, InvitationResult, StaffView } from '@/types/portal'

interface FormState {
  firstName: string
  lastName: string
  email: string
  phone: string
  address: string
  status: 'ACTIVE' | 'INACTIVE'
}

const emptyForm: FormState = {
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  address: '',
  status: 'ACTIVE',
}

function InvitationBadge({ invitation }: { invitation?: InvitationResult }) {
  if (!invitation) {
    return (
      <Badge tone="amber">
        <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
        Invitation pending
      </Badge>
    )
  }
  if (invitation.status === 'failed') {
    return (
      <Badge tone="red">
        <MailX className="h-3.5 w-3.5" aria-hidden="true" />
        Email failed — resend needed
      </Badge>
    )
  }
  if (invitation.status === 'dev') {
    return (
      <Badge tone="royal">
        <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
        Invitation logged (dev)
      </Badge>
    )
  }
  return (
    <Badge tone="green">
      <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
      Invitation {invitation.status === 'queued' ? 'queued for delivery' : 'sent'}
    </Badge>
  )
}

export function OwnerHeadteacherPage() {
  const { push } = useToast()
  const [headteachers, setHeadteachers] = useState<StaffView[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [form, setForm] = useState<FormState>(emptyForm)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)
  const [createResult, setCreateResult] = useState<CreateHeadteacherResult | null>(null)
  const [confirmTarget, setConfirmTarget] = useState<StaffView | null>(null)
  const [confirmStatus, setConfirmStatus] = useState<'ACTIVE' | 'INACTIVE'>('INACTIVE')
  const [actionLoading, setActionLoading] = useState(false)
  const [resendingId, setResendingId] = useState<string | null>(null)

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
    setCreateResult(null)
    setCreateOpen(true)
  }

  const closeCreate = () => {
    setCreateOpen(false)
    setCreateResult(null)
  }

  const handleCreate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setFieldErrors({})
    const errors: Record<string, string> = {}
    if (form.firstName.trim().length < 2) errors.firstName = 'First name must be at least 2 characters.'
    if (form.lastName.trim().length < 2) errors.lastName = 'Last name must be at least 2 characters.'
    if (!/^\S+@\S+\.\S+$/.test(form.email.trim())) errors.email = 'Enter a valid email address.'
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors)
      return
    }

    setSubmitting(true)
    try {
      const result = await api.createHeadteacher({
        firstName: form.firstName,
        lastName: form.lastName,
        email: form.email,
        phone: form.phone || undefined,
        address: form.address || undefined,
        status: form.status,
      })
      setCreateResult(result)
      const feedback = invitationFeedback(result.invitation, 'create')
      push(feedback.tone, feedback.message)
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

  const handleResendInvitation = async (id: string) => {
    setResendingId(id)
    try {
      const result = await api.resendHeadteacherInvitation(id)
      const feedback = invitationFeedback(result.invitation, 'resend')
      push(feedback.tone, feedback.message)
      await load()
    } catch (err) {
      push('error', err instanceof Error ? err.message : 'Could not resend the invitation.')
    } finally {
      setResendingId(null)
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
          description="Create the overall Headteacher account to hand over day-to-day school operations. An invitation email with a secure temporary credential is sent automatically."
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
                    {entry.mustChangePassword ? (
                      <Badge tone="amber">Awaiting password change</Badge>
                    ) : (
                      <Badge tone="green">Password set</Badge>
                    )}
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Button to={`/owner/headteacher/${entry.id}`} variant="soft" size="sm">
                    Manage account
                  </Button>
                  <Button to={`/owner/headteacher/${entry.id}?tab=permissions`} variant="outline" size="sm">
                    Permissions
                  </Button>
                  <Button
                    variant="cream"
                    size="sm"
                    disabled={resendingId === entry.id}
                    onClick={() => void handleResendInvitation(entry.id)}
                  >
                    {resendingId === entry.id ? (
                      <Spinner className="h-4 w-4" />
                    ) : (
                      <RefreshCw className="h-4 w-4" aria-hidden="true" />
                    )}
                    Resend invitation
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
        onClose={closeCreate}
        title="Create Headteacher account"
        description="The Headteacher is the overall operational administrator of the school platform."
        size="lg"
      >
        {createResult ? (
          <div className="space-y-4">
            <div
              className={[
                'flex items-start gap-3 rounded-xl border p-4',
                createResult.invitation.status === 'failed'
                  ? 'border-amber-200 bg-amber-50'
                  : createResult.invitation.status === 'dev'
                    ? 'border-royal-200 bg-royal-50'
                    : 'border-emerald-200 bg-emerald-50',
              ].join(' ')}
            >
              <CheckCircle2
                className={[
                  'mt-0.5 h-5 w-5 shrink-0',
                  createResult.invitation.status === 'failed'
                    ? 'text-amber-600'
                    : createResult.invitation.status === 'dev'
                      ? 'text-royal-600'
                      : 'text-emerald-600',
                ].join(' ')}
                aria-hidden="true"
              />
              <div>
                <p className="text-sm font-bold text-ink-900">Headteacher account created successfully.</p>
                <p className="mt-1 text-sm leading-relaxed text-ink-700">
                  {createResult.invitation.status === 'failed' ? (
                    'The invitation email could not be sent. You can resend it with a fresh temporary credential from the Headteacher list.'
                  ) : createResult.invitation.status === 'dev' ? (
                    'The invitation was logged to the server console (development transport). No real email was sent — configure EMAIL_* to deliver real mail.'
                  ) : (
                    'A secure invitation email has been sent to the address below. The temporary credential is delivered by email only — it is never shown again.'
                  )}
                </p>
              </div>
            </div>
            <dl className="grid gap-3 rounded-xl border border-cream-200 bg-cream-50 p-4 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wider text-ink-500">Headteacher ID</dt>
                <dd className="mt-0.5 font-bold text-ink-900">{createResult.headteacher.staffId ?? '—'}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wider text-ink-500">Email</dt>
                <dd className="mt-0.5 break-words font-bold text-ink-900">{createResult.headteacher.email}</dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-xs font-semibold uppercase tracking-wider text-ink-500">Invitation</dt>
                <dd className="mt-1">
                  <InvitationBadge invitation={createResult.invitation} />
                </dd>
              </div>
            </dl>
            {createResult.invitation.status === 'failed' ? (
              <p className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3.5 text-sm leading-relaxed text-amber-800">
                <MailX className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                The account was created, but the invitation email could not be sent. You can resend the
                invitation with a fresh temporary credential from the Headteacher list.
              </p>
            ) : createResult.invitation.status === 'dev' ? (
              <p className="text-xs leading-relaxed text-ink-500">
                Development transport in use — the invitation (including the temporary credential)
                appears in the backend server log only. Configure EMAIL_ENABLED and EMAIL_HOST to send
                real email.
              </p>
            ) : (
              <p className="text-xs leading-relaxed text-ink-500">
                For security, the temporary password is delivered only through the email invitation and is
                not displayed in this dashboard. The Headteacher must change it at first sign-in.
              </p>
            )}
            <div className="flex justify-end">
              <Button onClick={closeCreate}>Done</Button>
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
                hint="The Headteacher invitation with secure temporary credentials is sent to this address."
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
            <div className="flex items-center justify-end gap-2 sm:col-span-2">
              <Button variant="cream" type="button" onClick={closeCreate}>
                Cancel
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? <Spinner className="h-4 w-4" /> : null}
                Create account & send invitation
              </Button>
            </div>
          </form>
        )}
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