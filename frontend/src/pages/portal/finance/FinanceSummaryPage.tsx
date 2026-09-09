import { useCallback, useEffect, useState } from 'react'
import { ArrowRight, BookOpenCheck, ListChecks, Receipt, Wallet } from 'lucide-react'
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

export function FinanceSummaryPage() {
  const { user } = useAuth()
  const base = financeRoute(user?.roles ?? [])
  const [summary, setSummary] = useState<FinanceSummaryView | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setError(null)
    try {
      setSummary(await api.financeSummary())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load the finance summary.')
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const feeTypeRows = summary
    ? ([
        { type: 'TERMLY' as const, label: 'Termly fees' },
        { type: 'DAILY' as const, label: 'Daily fees' },
        { type: 'PA' as const, label: 'PA fees' },
        { type: 'OTHER' as const, label: 'Other fees' },
      ].map(({ type, label }) => ({
        type,
        label,
        count: summary.feeSummary.byType[type] ?? 0,
      }))
    )
    : []

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Fees & Finance"
        title="Finance Summary"
        description="A consolidated view of expected fees, collections, and outstanding balances."
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
                  hint="Active charges across all pupils"
                  icon={<Receipt className="h-5 w-5" aria-hidden="true" />}
                  tone="royal"
                />
                <StatCard
                  label="Collected"
                  value={formatMoney(summary.collected)}
                  hint="Active payments across all terms"
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
                  label="Collected this term"
                  value={formatMoney(summary.paymentsThisTerm)}
                  hint={`${summary.paymentsThisTermCount} payment(s)`}
                  icon={<Wallet className="h-5 w-5" aria-hidden="true" />}
                  tone="gold"
                />
              </>
            ) : (
              Array.from({ length: 4 }).map((_, index) => <CardSkeleton key={index} />)
            )}
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            {/* Fee summary */}
            <Card className="p-6">
              <div className="flex items-center justify-between">
                <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-ink-500">
                  <BookOpenCheck className="h-5 w-5 text-royal-500" aria-hidden="true" />
                  Fee Structures
                </h2>
                <Badge tone="royal">{summary?.feeSummary.total ?? 0} total</Badge>
              </div>
              {summary === null ? (
                <div className="mt-6 space-y-3">
                  <CardSkeleton className="border-0 p-0" />
                </div>
              ) : (
                <ul className="mt-5 space-y-3">
                  <li className="flex items-center justify-between rounded-xl border border-cream-200 bg-cream-50 p-4">
                    <span className="text-sm font-semibold text-ink-700">Active fees</span>
                    <span className="font-bold text-ink-900">{summary.feeSummary.active}</span>
                  </li>
                  {feeTypeRows.map((row) => (
                    <li key={row.type} className="flex items-center justify-between rounded-xl border border-cream-200 bg-cream-50 p-4">
                      <span className="text-sm font-semibold text-ink-700">{row.label}</span>
                      <span className="font-bold text-ink-900">{row.count}</span>
                    </li>
                  ))}
                </ul>
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
                  <EmptyState title="No payments recorded yet." />
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
                            {payment.paymentReference} · {formatDate(payment.paymentDate)}
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