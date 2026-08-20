import { useCallback, useEffect, useState } from 'react'
import { ArrowLeft, Receipt, Wallet } from 'lucide-react'
import { useParams } from 'react-router-dom'
import { useAuth } from '@/auth/AuthContext'
import { PageHeader } from '@/components/dashboard/PageHeader'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/dashboard/Badge'
import { CardSkeleton } from '@/components/dashboard/Loaders'
import { EmptyState, ErrorState } from '@/components/dashboard/States'
import { api } from '@/lib/api'
import { formatMoney } from '@/lib/money'
import { formatDate } from '@/lib/date'
import { financeRoute } from './financeRoute'
import type { PupilFinanceView } from '@/types/portal'

export function PupilFinanceProfilePage() {
  const { id } = useParams<{ id: string }>()
  const { user } = useAuth()
  const base = financeRoute(user?.roles ?? [])

  const [profile, setProfile] = useState<PupilFinanceView | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!id) return
    setError(null)
    try {
      setProfile(await api.getPupilFinance(id))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load the pupil finance profile.')
    }
  }, [id])

  useEffect(() => {
    void load()
  }, [load])

  if (error) {
    return (
      <div className="space-y-6">
        <Button variant="ghost-dark" size="sm" to={`${base}/pupils`}>
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Back to pupil finance
        </Button>
        <ErrorState message={error} onRetry={() => void load()} />
      </div>
    )
  }

  if (!profile) {
    return (
      <div className="space-y-6">
        <CardSkeleton />
        <CardSkeleton />
        <CardSkeleton />
      </div>
    )
  }

  const outstandingPositive = Number(profile.outstanding) > 0

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Fees & Finance"
        title={profile.pupil.fullName}
        description={`${profile.pupil.pupilId} · ${profile.pupil.className}. Fee charges and payment history for this pupil.`}
        actions={
          <Button variant="ghost-dark" size="sm" to={`${base}/pupils`}>
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Back to pupil finance
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="p-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-ink-500">Total due</p>
          <p className="mt-1 text-2xl font-extrabold text-ink-900">{formatMoney(profile.totalDue)}</p>
        </Card>
        <Card className="p-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-ink-500">Total paid</p>
          <p className="mt-1 text-2xl font-extrabold text-emerald-700">{formatMoney(profile.totalPaid)}</p>
        </Card>
        <Card className="p-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-ink-500">Outstanding</p>
          <p className={`mt-1 text-2xl font-extrabold ${outstandingPositive ? 'text-red-700' : 'text-ink-900'}`}>
            {formatMoney(profile.outstanding)}
          </p>
        </Card>
      </div>

      {/* Charges */}
      <Card className="p-6">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-ink-500">
            <Receipt className="h-5 w-5 text-royal-500" aria-hidden="true" />
            Fee charges
          </h2>
          <Badge tone="royal">{profile.charges.length} charge(s)</Badge>
        </div>
        <div className="mt-4">
          {profile.charges.length === 0 ? (
            <EmptyState
              icon={<Receipt className="h-7 w-7" aria-hidden="true" />}
              title="No charges for this pupil yet."
              description="Charges appear once fee structures are assigned to this pupil and charges are generated."
            />
          ) : (
            <ul className="space-y-3">
              {profile.charges.map((charge) => {
                const settled = Number(charge.balance) <= 0
                return (
                  <li
                    key={charge.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-cream-200 bg-cream-50 p-4"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-ink-900">{charge.feeName}</p>
                      <p className="text-xs text-ink-500">{charge.termName ?? 'No term'}</p>
                    </div>
                    <div className="flex items-center gap-4 text-sm">
                      <span className="text-ink-700">Amount {formatMoney(charge.amount)}</span>
                      <span className="font-semibold text-emerald-700">Paid {formatMoney(charge.paid)}</span>
                      <span className={`font-bold ${settled ? 'text-emerald-700' : 'text-red-700'}`}>
                        Balance {formatMoney(charge.balance)}
                      </span>
                      <Badge tone={settled ? 'green' : 'amber'}>{settled ? 'Settled' : 'Owing'}</Badge>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </Card>

      {/* Payments */}
      <Card className="p-6">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-ink-500">
            <Wallet className="h-5 w-5 text-royal-500" aria-hidden="true" />
            Payments
          </h2>
          <Badge tone="royal">{profile.payments.length} payment(s)</Badge>
        </div>
        <div className="mt-4">
          {profile.payments.length === 0 ? (
            <EmptyState
              icon={<Wallet className="h-7 w-7" aria-hidden="true" />}
              title="No payments recorded for this pupil yet."
              description="Payments recorded by the Accountant will appear here."
            />
          ) : (
            <ul className="space-y-3">
              {profile.payments.map((payment) => (
                <li
                  key={payment.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-cream-200 bg-cream-50 p-4"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-royal-700">{payment.paymentReference}</p>
                    <p className="text-xs text-ink-500">
                      {formatDate(payment.paymentDate)} · {payment.paymentMethod.replace('_', ' ')} ·{' '}
                      {payment.receivedByName}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-semibold text-emerald-700">{formatMoney(payment.amountPaid)}</span>
                    <Badge tone={payment.status === 'ACTIVE' ? 'green' : 'red'}>
                      {payment.status === 'ACTIVE' ? 'Active' : 'Voided'}
                    </Badge>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Card>
    </div>
  )
}