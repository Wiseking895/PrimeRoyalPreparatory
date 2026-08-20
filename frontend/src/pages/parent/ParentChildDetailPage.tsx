import { useEffect, useState } from 'react'
import { ArrowLeft, Baby, FileText, Wallet } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import { PageHeader } from '@/components/dashboard/PageHeader'
import { CardSkeleton } from '@/components/dashboard/Loaders'
import { ErrorState } from '@/components/dashboard/States'
import { cn } from '@/lib/cn'
import { api } from '@/lib/api'
import { formatDate } from '@/lib/date'
import { formatMoney } from '@/lib/money'
import type { ParentChildView, PupilFinanceView, ReportTermOption } from '@/types/portal'

type Tab = 'profile' | 'finance' | 'reports'

const tabs: Array<{ key: Tab; label: string }> = [
  { key: 'profile', label: 'Profile' },
  { key: 'finance', label: 'Fees & Payments' },
  { key: 'reports', label: 'Reports' },
]

export function ParentChildDetailPage() {
  const { pupilId = '' } = useParams<{ pupilId: string }>()
  const [child, setChild] = useState<ParentChildView | null>(null)
  const [finance, setFinance] = useState<PupilFinanceView | null>(null)
  const [reports, setReports] = useState<ReportTermOption[] | null>(null)
  const [tab, setTab] = useState<Tab>('profile')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    setLoading(true)
    setError(null)
    api
      .getMyChild(pupilId)
      .then((result) => {
        if (!active) return
        setChild(result)
        return Promise.all([api.getMyChildFinance(pupilId), api.getMyChildReports(pupilId)])
          .then(([financeResult, reportsResult]) => {
            if (!active) return
            setFinance(financeResult)
            setReports(reportsResult)
          })
      })
      .catch((err) => {
        if (active) setError(err instanceof Error ? err.message : 'Failed to load the child record.')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [pupilId])

  if (loading) {
    return <CardSkeleton />
  }

  if (error || !child) {
    return (
      <ErrorState
        title="Cannot open this child"
        message={error ?? 'This child is not linked to your account.'}
        onRetry={() => window.location.reload()}
      />
    )
  }

  return (
    <div className="space-y-6">
      <Link
        to="/parent/children"
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-royal-600 transition-colors hover:text-magenta-600"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        All children
      </Link>

      <PageHeader
        eyebrow="My Child"
        title={child.fullName}
        description={`${child.pupilId} · ${child.className} · Born ${formatDate(child.dateOfBirth)}`}
      />

      <div className="flex flex-wrap gap-1 rounded-2xl border border-cream-300/70 bg-white p-1.5 shadow-[0_2px_16px_-8px_rgba(11,20,48,0.1)]">
        {tabs.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => setTab(item.key)}
            className={cn(
              'flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors',
              tab === item.key ? 'bg-royal-600 text-white shadow-sm' : 'text-ink-500 hover:text-ink-900',
            )}
          >
            {item.key === 'profile' ? (
              <Baby className="h-4 w-4" aria-hidden="true" />
            ) : item.key === 'finance' ? (
              <Wallet className="h-4 w-4" aria-hidden="true" />
            ) : (
              <FileText className="h-4 w-4" aria-hidden="true" />
            )}
            {item.label}
          </button>
        ))}
      </div>

      {tab === 'profile' ? (
        <div className="rounded-2xl border border-cream-300/70 bg-white p-6 shadow-[0_2px_16px_-8px_rgba(11,20,48,0.1)]">
          <h2 className="text-lg font-extrabold tracking-tight text-ink-900">Profile</h2>
          <dl className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <dt className="text-xs font-bold uppercase tracking-wider text-ink-500">Full name</dt>
              <dd className="mt-1 text-sm font-semibold text-ink-900">{child.fullName}</dd>
            </div>
            <div>
              <dt className="text-xs font-bold uppercase tracking-wider text-ink-500">Admission number</dt>
              <dd className="mt-1 text-sm font-semibold text-ink-900">{child.pupilId}</dd>
            </div>
            <div>
              <dt className="text-xs font-bold uppercase tracking-wider text-ink-500">Class</dt>
              <dd className="mt-1 text-sm font-semibold text-ink-900">{child.className}</dd>
            </div>
            <div>
              <dt className="text-xs font-bold uppercase tracking-wider text-ink-500">Gender</dt>
              <dd className="mt-1 text-sm font-semibold text-ink-900">
                {child.gender === 'MALE' ? 'Male' : 'Female'}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-bold uppercase tracking-wider text-ink-500">Date of birth</dt>
              <dd className="mt-1 text-sm font-semibold text-ink-900">{formatDate(child.dateOfBirth)}</dd>
            </div>
            <div>
              <dt className="text-xs font-bold uppercase tracking-wider text-ink-500">Status</dt>
              <dd className="mt-1 text-sm font-semibold text-ink-900">
                {child.status === 'ACTIVE' ? 'Active' : 'Inactive'}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-bold uppercase tracking-wider text-ink-500">Relationship</dt>
              <dd className="mt-1 text-sm font-semibold text-ink-900">{child.relationship ?? 'Guardian'}</dd>
            </div>
            <div>
              <dt className="text-xs font-bold uppercase tracking-wider text-ink-500">Primary contact</dt>
              <dd className="mt-1 text-sm font-semibold text-ink-900">{child.isPrimary ? 'Yes' : 'No'}</dd>
            </div>
          </dl>
        </div>
      ) : null}

      {tab === 'finance' ? (
        finance ? (
          <div className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="rounded-2xl border border-cream-300/70 bg-white p-5">
                <p className="text-xs font-bold uppercase tracking-wider text-ink-500">Total due</p>
                <p className="mt-2 text-2xl font-extrabold text-ink-900">₦{formatMoney(finance.totalDue)}</p>
              </div>
              <div className="rounded-2xl border border-cream-300/70 bg-white p-5">
                <p className="text-xs font-bold uppercase tracking-wider text-ink-500">Total paid</p>
                <p className="mt-2 text-2xl font-extrabold text-emerald-600">₦{formatMoney(finance.totalPaid)}</p>
              </div>
              <div className="rounded-2xl border border-cream-300/70 bg-white p-5">
                <p className="text-xs font-bold uppercase tracking-wider text-ink-500">Outstanding</p>
                <p
                  className={cn(
                    'mt-2 text-2xl font-extrabold',
                    Number(finance.outstanding) > 0 ? 'text-red-600' : 'text-emerald-600',
                  )}
                >
                  ₦{formatMoney(finance.outstanding)}
                </p>
              </div>
            </div>

            <div className="rounded-2xl border border-cream-300/70 bg-white p-6">
              <h2 className="text-lg font-extrabold tracking-tight text-ink-900">Charges</h2>
              {finance.charges.length > 0 ? (
                <div className="mt-4 overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-cream-200 text-[11px] uppercase tracking-wider text-ink-500">
                        <th className="py-2.5 pr-4 font-bold">Fee</th>
                        <th className="py-2.5 pr-4 text-right font-bold">Amount</th>
                        <th className="py-2.5 pr-4 text-right font-bold">Paid</th>
                        <th className="py-2.5 text-right font-bold">Balance</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-cream-100">
                      {finance.charges.map((charge) => (
                        <tr key={charge.id}>
                          <td className="py-3 pr-4 font-semibold text-ink-900">
                            {charge.feeName}
                            {charge.termName ? (
                              <span className="ml-2 text-xs font-normal text-ink-400">{charge.termName}</span>
                            ) : null}
                          </td>
                          <td className="py-3 pr-4 text-right tabular-nums text-ink-700">
                            ₦{formatMoney(charge.amount)}
                          </td>
                          <td className="py-3 pr-4 text-right tabular-nums text-emerald-600">
                            ₦{formatMoney(charge.paid)}
                          </td>
                          <td className="py-3 text-right tabular-nums font-bold text-ink-900">
                            ₦{formatMoney(charge.balance)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="mt-3 text-sm text-ink-500">No fee charges have been recorded for this child.</p>
              )}
            </div>
          </div>
        ) : (
          <CardSkeleton />
        )
      ) : null}

      {tab === 'reports' ? (
        reports ? (
          <div className="rounded-2xl border border-cream-300/70 bg-white p-6">
            <h2 className="text-lg font-extrabold tracking-tight text-ink-900">Terminal Reports</h2>
            {reports.length > 0 ? (
              <ul className="mt-4 divide-y divide-cream-100">
                {reports.map((term) => (
                  <li key={term.id} className="flex items-center justify-between gap-4 py-4">
                    <div>
                      <p className="text-sm font-bold text-ink-900">
                        {term.name} — {term.sessionName}
                      </p>
                      <p className="mt-0.5 text-xs text-ink-500">
                        {term.hasReport
                          ? 'Report available'
                          : 'No assessments recorded for this term yet'}
                      </p>
                    </div>
                    {term.hasReport ? (
                      <Link
                        to={`/parent/children/${pupilId}/reports/${term.id}`}
                        className="rounded-full bg-magenta-500 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-magenta-600"
                      >
                        View report
                      </Link>
                    ) : (
                      <span className="text-xs font-semibold text-ink-400">Not ready</span>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-sm text-ink-500">
                No academic terms have been set up yet. Please check back later.
              </p>
            )}
          </div>
        ) : (
          <CardSkeleton />
        )
      ) : null}
    </div>
  )
}