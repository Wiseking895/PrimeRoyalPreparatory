import { useCallback, useEffect, useState } from 'react'
import {
  ArrowRight,
  BookOpenCheck,
  CalendarDays,
  ListChecks,
  Receipt,
  ScrollText,
  Users,
  Wallet,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/auth/AuthContext'
import { PageHeader } from '@/components/dashboard/PageHeader'
import { StatCard } from '@/components/dashboard/StatCard'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/dashboard/Badge'
import { CardSkeleton, TableSkeleton } from '@/components/dashboard/Loaders'
import { ErrorState, EmptyState } from '@/components/dashboard/States'
import { api } from '@/lib/api'
import { formatMoney } from '@/lib/money'
import { formatDate } from '@/lib/date'
import { financeRoute } from './financeRoute'
import type { FinanceSummaryView } from '@/types/portal'

function greeting(): string {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}

export function FinanceDashboardPage() {
  const { user } = useAuth()
  const base = financeRoute(user?.roles ?? [])
  const [summary, setSummary] = useState<FinanceSummaryView | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setError(null)
    try {
      setSummary(await api.financeSummary())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load the finance dashboard.')
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Finance Dashboard"
        title={`${greeting()}, ${user?.fullName.split(' ')[0] ?? 'Accountant'}`}
        description="Prime Royal Preparatory School — fees, assignments, charges and payment collection at a glance."
      />

      {error ? (
        <ErrorState message={error} onRetry={() => void load()} />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {summary ? (
              <>
                <StatCard
                  label="Expected Fees"
                  value={formatMoney(summary.expectedFees)}
                  hint={
                    summary.session
                      ? `${summary.session.name} · ${summary.term?.name ?? 'No active term'}`
                      : 'No active session'
                  }
                  icon={<Receipt className="h-5 w-5" aria-hidden="true" />}
                  tone="royal"
                />
                <StatCard
                  label="Collected"
                  value={formatMoney(summary.collected)}
                  hint={`${summary.paymentsThisTermCount} payment(s) this term`}
                  icon={<Wallet className="h-5 w-5" aria-hidden="true" />}
                  tone="green"
                />
                <StatCard
                  label="Outstanding"
                  value={formatMoney(summary.outstanding)}
                  hint={`${summary.pupilsWithOutstanding} pupil(s) with a balance`}
                  icon={<ListChecks className="h-5 w-5" aria-hidden="true" />}
                  tone="magenta"
                />
                <StatCard
                  label="Fee Structures"
                  value={summary.feeSummary.total}
                  hint={`${summary.feeSummary.active} active`}
                  icon={<BookOpenCheck className="h-5 w-5" aria-hidden="true" />}
                  tone="gold"
                />
              </>
            ) : (
              Array.from({ length: 4 }).map((_, index) => <CardSkeleton key={index} />)
            )}
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            {/* Quick actions */}
            <Card className="p-6">
              <h2 className="text-sm font-bold uppercase tracking-wider text-ink-500">Quick Actions</h2>
              <ul className="mt-4 space-y-1">
                {[
                  { label: 'Fee Structures', to: `${base}/fees`, icon: Receipt },
                  { label: 'Record Payment', to: `${base}/payments`, icon: Wallet },
                  { label: 'Charge Generation', to: `${base}/charges`, icon: ListChecks },
                  { label: 'Pupil Finance', to: `${base}/pupils`, icon: Users },
                  { label: 'Sessions & Terms', to: `${base}/sessions`, icon: CalendarDays },
                  { label: 'Finance Summary', to: `${base}/summary`, icon: ScrollText },
                ].map(({ label, to, icon: Icon }) => (
                  <li key={label}>
                    <Link
                      to={to}
                      className="group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-ink-700 transition-colors hover:bg-cream-100 hover:text-magenta-600"
                    >
                      <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-royal-600/10 text-royal-600">
                        <Icon className="h-4.5 w-4.5" aria-hidden="true" />
                      </span>
                      <span className="flex-1">{label}</span>
                      <ArrowRight
                        className="h-4 w-4 text-ink-500 transition-transform group-hover:translate-x-0.5"
                        aria-hidden="true"
                      />
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>

            {/* Active session & term */}
            <Card className="p-6">
              <div className="flex items-center justify-between">
                <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-ink-500">
                  <CalendarDays className="h-5 w-5 text-royal-500" aria-hidden="true" />
                  Academic Period
                </h2>
              </div>
              {summary === null ? (
                <div className="mt-6 space-y-3">
                  <CardSkeleton className="border-0 p-0" />
                </div>
              ) : !summary.session ? (
                <EmptyState
                  icon={<CalendarDays className="h-7 w-7" aria-hidden="true" />}
                  title="No active academic session."
                  description="Sessions and terms are managed by academic administration."
                />
              ) : (
                <div className="mt-5 space-y-4">
                  <div className="rounded-xl border border-cream-200 bg-cream-50 p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-bold text-ink-900">{summary.session.name}</p>
                      <Badge tone={summary.session.status === 'ACTIVE' ? 'green' : 'red'}>
                        {summary.session.status === 'ACTIVE' ? 'Active' : 'Inactive'}
                      </Badge>
                    </div>
                    <p className="mt-1 text-xs text-ink-500">
                      {formatDate(summary.session.startDate)} — {formatDate(summary.session.endDate)}
                    </p>
                    <p className="mt-1 text-xs text-ink-500">
                      {summary.session.termCount} term(s) · {summary.session.feeCount} fee structure(s)
                    </p>
                  </div>
                  {summary.term ? (
                    <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-bold text-ink-900">{summary.term.name}</p>
                        <Badge tone="green">Active term</Badge>
                      </div>
                      <p className="mt-1 text-xs text-ink-500">
                        Term {summary.term.termNumber} · {summary.term.schoolDays} school day(s)
                      </p>
                      <p className="mt-0.5 text-xs text-ink-500">
                        {formatDate(summary.term.startDate)} — {formatDate(summary.term.endDate)}
                      </p>
                    </div>
                  ) : (
                    <EmptyState title="No active term." description="Activate a term to start collecting." />
                  )}
                </div>
              )}
            </Card>

            {/* Recent payments */}
            <Card className="p-6">
              <div className="flex items-center justify-between">
                <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-ink-500">
                  <Wallet className="h-5 w-5 text-royal-500" aria-hidden="true" />
                  Recent Payments
                </h2>
                <Link
                  to={`${base}/payments`}
                  className="inline-flex items-center gap-1.5 text-sm font-semibold text-magenta-600 transition-colors hover:text-magenta-700"
                >
                  View all <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
              </div>
              <div className="mt-4">
                {summary === null ? (
                  <TableSkeleton rows={4} />
                ) : summary.recentPayments.length === 0 ? (
                  <EmptyState
                    title="No payments recorded yet."
                    description="Payments recorded for active fee charges will appear here."
                  />
                ) : (
                  <ul className="space-y-3">
                    {summary.recentPayments.map((payment) => (
                      <li key={payment.id} className="flex items-start gap-3">
                        <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-emerald-500" aria-hidden="true" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-ink-900">
                            {payment.pupilName} — {formatMoney(payment.amountPaid)}
                          </p>
                          <p className="truncate text-xs text-ink-500">
                            {payment.paymentReference} · {payment.paymentMethod.replace('_', ' ')} ·{' '}
                            {formatDate(payment.paymentDate)}
                          </p>
                        </div>
                        <Badge tone={payment.status === 'VOIDED' ? 'red' : 'green'}>
                          {payment.status === 'VOIDED' ? 'Voided' : 'Active'}
                        </Badge>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </Card>
          </div>
        </>
      )}
    </div>
  )
}