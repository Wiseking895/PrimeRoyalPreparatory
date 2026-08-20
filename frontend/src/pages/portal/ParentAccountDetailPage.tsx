import { useEffect, useState } from 'react'
import { ArrowLeft, KeyRound, RotateCcw } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import { useAuth } from '@/auth/AuthContext'
import { portalBasePath } from '@/auth/roles'
import { PageHeader } from '@/components/dashboard/PageHeader'
import { CardSkeleton } from '@/components/dashboard/Loaders'
import { ErrorState } from '@/components/dashboard/States'
import { useToast } from '@/components/dashboard/Toast'
import { cn } from '@/lib/cn'
import { api } from '@/lib/api'
import type { GuardianAccountView } from '@/types/portal'

export function ParentAccountDetailPage() {
  const { id = '' } = useParams<{ id: string }>()
  const { user, hasPermission } = useAuth()
  const basePath = portalBasePath(user?.roles ?? [])
  const toast = useToast()

  const [guardian, setGuardian] = useState<GuardianAccountView | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const canManage = hasPermission('guardians.manage')

  const load = () => {
    api
      .getGuardian(id)
      .then(setGuardian)
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load the guardian.'))
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  const handleResend = async () => {
    if (!guardian) return
    if (!window.confirm(`Send a new invitation to ${guardian.accountEmail}?`)) return
    setBusy(true)
    try {
      const result = await api.resendParentInvitation(guardian.id)
      toast.push('success', `A new invitation was sent to ${result.guardian.accountEmail}.`)
      load()
    } catch (err) {
      toast.push('error', err instanceof Error ? err.message : 'Could not resend the invitation.')
    } finally {
      setBusy(false)
    }
  }

  const handleStatus = async (status: 'ACTIVE' | 'INACTIVE') => {
    if (!guardian) return
    const label = status === 'ACTIVE' ? 'activate' : 'deactivate'
    if (!window.confirm(`Are you sure you want to ${label} this parent account?`)) return
    setBusy(true)
    try {
      await api.setParentAccountStatus(guardian.id, status)
      toast.push('success', status === 'ACTIVE' ? 'Parent account activated.' : 'Parent account deactivated.')
      load()
    } catch (err) {
      toast.push('error', err instanceof Error ? err.message : 'Could not update the account.')
    } finally {
      setBusy(false)
    }
  }

  const handleCreate = async () => {
    if (!guardian) return
    setBusy(true)
    try {
      const result = await api.createParentAccount(guardian.id)
      toast.push('success', `Invitation sent to ${result.guardian.accountEmail}.`)
      load()
    } catch (err) {
      toast.push('error', err instanceof Error ? err.message : 'Could not create the parent account.')
    } finally {
      setBusy(false)
    }
  }

  if (error && !guardian) {
    return <ErrorState title="Cannot open guardian" message={error} onRetry={load} />
  }

  if (!guardian) {
    return <CardSkeleton />
  }

  return (
    <div className="space-y-6">
      <Link
        to={`${basePath}/guardians`}
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-royal-600 transition-colors hover:text-magenta-600"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        All guardians
      </Link>

      <PageHeader
        eyebrow="Parent Account"
        title={guardian.fullName}
        description={`${guardian.phone ?? 'No phone'} · ${guardian.linkedPupilCount} linked child(ren)`}
        actions={
          canManage ? (
            !guardian.hasAccount ? (
              <button
                type="button"
                onClick={handleCreate}
                disabled={busy}
                className="inline-flex items-center gap-2 rounded-full bg-magenta-500 px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-magenta-600 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <KeyRound className="h-4 w-4" aria-hidden="true" />
                Create parent account
              </button>
            ) : (
              <span className="inline-flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleResend}
                  disabled={busy}
                  className="inline-flex items-center gap-2 rounded-full bg-royal-600 px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-royal-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <RotateCcw className="h-4 w-4" aria-hidden="true" />
                  Resend invitation
                </button>
                <button
                  type="button"
                  onClick={() => handleStatus(guardian.accountStatus === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE')}
                  disabled={busy}
                  className={cn(
                    'rounded-full px-5 py-2.5 text-sm font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-60',
                    guardian.accountStatus === 'ACTIVE'
                      ? 'bg-red-100 text-red-700 hover:bg-red-200'
                      : 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200',
                  )}
                >
                  {guardian.accountStatus === 'ACTIVE' ? 'Deactivate' : 'Activate'}
                </button>
              </span>
            )
          ) : undefined
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-2xl border border-cream-300/70 bg-white p-5">
          <p className="text-xs font-bold uppercase tracking-wider text-ink-500">Account status</p>
          <p className="mt-2 text-2xl font-extrabold text-ink-900">
            {guardian.hasAccount ? (guardian.accountStatus === 'ACTIVE' ? 'Active' : 'Inactive') : 'No account'}
          </p>
        </div>
        <div className="rounded-2xl border border-cream-300/70 bg-white p-5">
          <p className="text-xs font-bold uppercase tracking-wider text-ink-500">Sign-in email</p>
          <p className="mt-2 text-lg font-bold text-ink-900">{guardian.accountEmail ?? '—'}</p>
        </div>
        <div className="rounded-2xl border border-cream-300/70 bg-white p-5">
          <p className="text-xs font-bold uppercase tracking-wider text-ink-500">Linked children</p>
          <p className="mt-2 text-2xl font-extrabold text-ink-900">{guardian.linkedPupilCount}</p>
        </div>
      </div>

      {!guardian.hasAccount ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-800">
          This guardian does not have a Parent Portal account yet. Create one to send them an
          invitation email with a temporary password.
        </div>
      ) : null}
    </div>
  )
}