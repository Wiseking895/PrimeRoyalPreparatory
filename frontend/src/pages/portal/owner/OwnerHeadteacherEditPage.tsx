import { useCallback, useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { ArrowLeft, RefreshCw, Save, ShieldCheck, UserCog } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import { PageHeader } from '@/components/dashboard/PageHeader'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Avatar } from '@/components/dashboard/Avatar'
import { StatusBadge, Badge } from '@/components/dashboard/Badge'
import { TextField, SelectField, TextAreaField } from '@/components/dashboard/Field'
import { Spinner, TableSkeleton } from '@/components/dashboard/Loaders'
import { ErrorState } from '@/components/dashboard/States'
import { useToast } from '@/components/dashboard/Toast'
import { api } from '@/lib/api'
import { invitationFeedback } from '@/lib/invitation'
import type { PublicUser } from '@/types/portal'

export function OwnerHeadteacherEditPage() {
  const { id = '' } = useParams()
  const { push } = useToast()

  const [headteacher, setHeadteacher] = useState<PublicUser | null>(null)
  const [error, setError] = useState<string | null>(null)

  const [profile, setProfile] = useState({ firstName: '', lastName: '', email: '', phone: '', address: '' })
  const [profileLoaded, setProfileLoaded] = useState(false)
  const [profileSaving, setProfileSaving] = useState(false)
  const [statusLoading, setStatusLoading] = useState(false)
  const [resending, setResending] = useState(false)

  const load = useCallback(async () => {
    setError(null)
    try {
      const headteacherData = await api.getHeadteacher(id)
      setHeadteacher(headteacherData)
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

  const handleResendInvitation = async () => {
    setResending(true)
    try {
      const result = await api.resendHeadteacherInvitation(id)
      setHeadteacher(result.headteacher)
      const feedback = invitationFeedback(result.invitation, 'resend')
      push(feedback.tone, feedback.message)
    } catch (err) {
      push('error', err instanceof Error ? err.message : 'Could not resend the invitation.')
    } finally {
      setResending(false)
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

  if (headteacher === null) {
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
            <Button
              variant="soft"
              onClick={() => void handleResendInvitation()}
              disabled={resending}
            >
              {resending ? <Spinner className="h-4 w-4" /> : <RefreshCw className="h-4 w-4" aria-hidden="true" />}
              Resend invitation
            </Button>
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
              {headteacher.mustChangePassword ? <Badge tone="amber">Awaiting password change</Badge> : null}
            </div>
            <p className="mt-2 max-w-2xl text-sm text-ink-500">
              The Headteacher is the overall operational administrator with the standard
              HEADTEACHER role permissions. These permissions are defined by the system and
              cannot be modified.
            </p>
          </div>
        </div>
      </Card>

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

      <Card className="p-5">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-royal-600/10 text-royal-600">
            <ShieldCheck className="h-5 w-5" aria-hidden="true" />
          </span>
          <div>
            <p className="text-sm font-bold text-ink-900">Headteacher Role Permissions</p>
            <p className="mt-1 text-sm leading-relaxed text-ink-500">
              The Headteacher automatically receives the standard permissions defined for the
              HEADTEACHER role. These include: staff management, pupil management, class management,
              academic administration, attendance, reports, teacher/subject/assignment management,
              SBA, finance view, and notifications. The Owner cannot modify these permissions.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {headteacher.permissions.slice(0, 10).map((perm) => (
                <Badge key={perm} tone="royal">{perm}</Badge>
              ))}
              {headteacher.permissions.length > 10 ? (
                <Badge tone="royal">+{headteacher.permissions.length - 10} more</Badge>
              ) : null}
            </div>
          </div>
        </div>
      </Card>
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
