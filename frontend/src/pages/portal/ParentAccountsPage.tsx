import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { KeyRound, MailPlus, RotateCcw, Search, UserPlus, Users } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/auth/AuthContext'
import { portalBasePath } from '@/auth/roles'
import { PageHeader } from '@/components/dashboard/PageHeader'
import { CardSkeleton } from '@/components/dashboard/Loaders'
import { EmptyState, ErrorState } from '@/components/dashboard/States'
import { Modal } from '@/components/dashboard/Modal'
import { Spinner } from '@/components/dashboard/Loaders'
import { TextField } from '@/components/dashboard/Field'
import { useToast } from '@/components/dashboard/Toast'
import { cn } from '@/lib/cn'
import { api } from '@/lib/api'
import type { GuardianAccountView } from '@/types/portal'

type AccountFilter = 'all' | 'has_account' | 'no_account'

export function ParentAccountsPage() {
  const { user, hasPermission } = useAuth()
  const basePath = portalBasePath(user?.roles ?? [])
  const toast = useToast()

  const [guardians, setGuardians] = useState<GuardianAccountView[] | null>(null)
  const [total, setTotal] = useState(0)
  const [q, setQ] = useState('')
  const [filter, setFilter] = useState<AccountFilter>('all')
  const [error, setError] = useState<string | null>(null)

  const [creating, setCreating] = useState<GuardianAccountView | null>(null)
  const [accountEmail, setAccountEmail] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const canManage = hasPermission('guardians.manage')

  const load = () => {
    api
      .listGuardians({
        q: q.trim() || undefined,
        account: filter === 'all' ? undefined : filter,
      })
      .then((result) => {
        setGuardians(result.items)
        setTotal(result.total)
        setError(null)
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Failed to load guardians.')
      })
  }

  useEffect(() => {
    setGuardians(null)
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, filter])

  const openCreate = (guardian: GuardianAccountView) => {
    setCreating(guardian)
    setAccountEmail(guardian.accountEmail ?? guardian.email ?? '')
  }

  const handleCreate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!creating) return
    setSubmitting(true)
    try {
      const result = await api.createParentAccount(creating.id, accountEmail.trim() || undefined)
      toast.push('success', `Invitation sent to ${result.guardian.accountEmail}.`)
      setCreating(null)
      load()
    } catch (err) {
      toast.push('error', err instanceof Error ? err.message : 'Could not create the parent account.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleResend = async (guardian: GuardianAccountView) => {
    if (!window.confirm(`Send a new invitation to ${guardian.accountEmail}?`)) return
    try {
      const result = await api.resendParentInvitation(guardian.id)
      toast.push('success', `A new invitation was sent to ${result.guardian.accountEmail}.`)
      load()
    } catch (err) {
      toast.push('error', err instanceof Error ? err.message : 'Could not resend the invitation.')
    }
  }

  const handleStatus = async (guardian: GuardianAccountView, status: 'ACTIVE' | 'INACTIVE') => {
    const label = status === 'ACTIVE' ? 'activate' : 'deactivate'
    if (!window.confirm(`Are you sure you want to ${label} ${guardian.fullName}'s parent account?`)) return
    try {
      await api.setParentAccountStatus(guardian.id, status)
      toast.push('success', status === 'ACTIVE' ? 'Parent account activated.' : 'Parent account deactivated.')
      load()
    } catch (err) {
      toast.push('error', err instanceof Error ? err.message : 'Could not update the account.')
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Parent Accounts"
        title="Guardians & Parent Portal"
        description="Provision and manage parent accounts. Parents sign in with the email shown and a temporary password delivered by email."
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-xs">
          <Search
            className="pointer-events-none absolute left-4 top-1/2 h-4.5 w-4.5 -translate-y-1/2 text-ink-500"
            aria-hidden="true"
          />
          <input
            type="search"
            value={q}
            onChange={(event) => setQ(event.target.value)}
            placeholder="Search guardians…"
            className="h-12 w-full rounded-xl border border-cream-300 bg-white pl-11 pr-4 text-sm text-ink-900 outline-none transition-colors placeholder:text-ink-500/60 focus:border-magenta-500"
          />
        </div>
        <div className="flex flex-wrap gap-1 rounded-2xl border border-cream-300/70 bg-white p-1.5">
          {(['all', 'has_account', 'no_account'] as const).map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setFilter(option)}
              className={cn(
                'rounded-xl px-3.5 py-2 text-sm font-semibold transition-colors',
                filter === option ? 'bg-royal-600 text-white' : 'text-ink-500 hover:text-ink-900',
              )}
            >
              {option === 'all' ? 'All' : option === 'has_account' ? 'With account' : 'No account'}
            </button>
          ))}
        </div>
      </div>

      {guardians === null && !error ? (
        <CardSkeleton />
      ) : error ? (
        <ErrorState title="Could not load guardians" message={error} onRetry={load} />
      ) : guardians && guardians.length > 0 ? (
        <div className="overflow-hidden rounded-2xl border border-cream-300/70 bg-white shadow-[0_2px_16px_-8px_rgba(11,20,48,0.1)]">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-cream-200 bg-cream-50 text-[11px] uppercase tracking-wider text-ink-500">
                <th className="px-6 py-3 font-bold">Guardian</th>
                <th className="px-4 py-3 font-bold">Account email</th>
                <th className="px-4 py-3 font-bold">Status</th>
                <th className="px-4 py-3 text-right font-bold">Children</th>
                <th className="px-6 py-3 text-right font-bold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-cream-100">
              {guardians.map((guardian) => (
                <tr key={guardian.id} className="transition-colors hover:bg-cream-50">
                  <td className="px-6 py-3">
                    <LinkRow guardian={guardian} basePath={basePath} />
                  </td>
                  <td className="px-4 py-3 text-ink-700">{guardian.accountEmail ?? '—'}</td>
                  <td className="px-4 py-3">
                    {guardian.hasAccount ? (
                      <span
                        className={cn(
                          'inline-flex rounded-full px-2.5 py-0.5 text-xs font-bold ring-1 ring-inset',
                          guardian.accountStatus === 'ACTIVE'
                            ? 'bg-emerald-100 text-emerald-700 ring-emerald-600/20'
                            : 'bg-cream-200 text-ink-500 ring-ink-500/20',
                        )}
                      >
                        {guardian.accountStatus === 'ACTIVE' ? 'Active' : 'Inactive'}
                      </span>
                    ) : (
                      <span className="inline-flex rounded-full bg-cream-200 px-2.5 py-0.5 text-xs font-bold text-ink-500">
                        No account
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-ink-700">
                    {guardian.linkedPupilCount}
                  </td>
                  <td className="px-6 py-3 text-right">
                    {!guardian.hasAccount && canManage ? (
                      <button
                        type="button"
                        onClick={() => openCreate(guardian)}
                        className="inline-flex items-center gap-1.5 rounded-full bg-magenta-500 px-4 py-2 text-xs font-bold text-white transition-colors hover:bg-magenta-600"
                      >
                        <UserPlus className="h-3.5 w-3.5" aria-hidden="true" />
                        Create account
                      </button>
                    ) : canManage ? (
                      <span className="inline-flex flex-wrap items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => handleResend(guardian)}
                          className="inline-flex items-center gap-1.5 rounded-full bg-royal-600 px-3.5 py-2 text-xs font-bold text-white transition-colors hover:bg-royal-700"
                        >
                          <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                          Resend
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            handleStatus(
                              guardian,
                              guardian.accountStatus === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE',
                            )
                          }
                          className={cn(
                            'inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-bold transition-colors',
                            guardian.accountStatus === 'ACTIVE'
                              ? 'bg-red-100 text-red-700 hover:bg-red-200'
                              : 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200',
                          )}
                        >
                          {guardian.accountStatus === 'ACTIVE' ? 'Deactivate' : 'Activate'}
                        </button>
                      </span>
                    ) : (
                      <span className="text-xs text-ink-400">View only</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {total > 0 ? (
            <p className="border-t border-cream-200 px-6 py-3 text-xs text-ink-500">{total} guardian(s)</p>
          ) : null}
        </div>
      ) : (
        <EmptyState
          icon={<Users className="h-7 w-7" aria-hidden="true" />}
          title="No guardians found"
          description="Try a different search or filter."
        />
      )}

      <Modal
        open={creating !== null}
        onClose={() => setCreating(null)}
        title="Create parent account"
        description={
          creating
            ? `${creating.fullName} will receive an invitation email with a temporary password.`
            : undefined
        }
      >
        {creating ? (
          <form onSubmit={handleCreate} noValidate className="space-y-4">
            <TextField
              label="Sign-in email"
              name="accountEmail"
              type="email"
              value={accountEmail}
              onChange={(event) => setAccountEmail(event.target.value)}
              hint="Parents sign in with this email only. Leave blank to use the guardian's email."
              required
            />
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setCreating(null)}
                className="rounded-full border border-cream-300 px-5 py-2.5 text-sm font-semibold text-ink-700 transition-colors hover:bg-cream-100"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="inline-flex items-center gap-2 rounded-full bg-magenta-500 px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-magenta-600 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting ? (
                  <>
                    <Spinner className="h-4 w-4" /> Creating…
                  </>
                ) : (
                  <>
                    <KeyRound className="h-4 w-4" aria-hidden="true" /> Create account
                  </>
                )}
              </button>
            </div>
            <p className="flex items-start gap-2 rounded-xl bg-cream-100 p-3 text-xs leading-relaxed text-ink-500">
              <MailPlus className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              The temporary password is only delivered by email and is never shown in this portal.
            </p>
          </form>
        ) : null}
      </Modal>
    </div>
  )
}

function LinkRow({ guardian, basePath }: { guardian: GuardianAccountView; basePath: string }) {
  return (
    <Link
      to={`${basePath}/guardians/${guardian.id}`}
      className="group block font-semibold text-ink-900 hover:text-magenta-600"
    >
      {guardian.fullName}
      <span className="ml-2 text-xs font-normal text-ink-400 group-hover:text-magenta-600">
        {guardian.phone ?? 'No phone'}
      </span>
    </Link>
  )
}