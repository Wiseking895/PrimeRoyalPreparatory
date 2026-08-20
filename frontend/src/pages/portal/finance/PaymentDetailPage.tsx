import { useCallback, useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { ArrowLeft, Ban, Wallet } from 'lucide-react'
import { useParams } from 'react-router-dom'
import { useAuth } from '@/auth/AuthContext'
import { PageHeader } from '@/components/dashboard/PageHeader'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/dashboard/Badge'
import { Modal } from '@/components/dashboard/Modal'
import { TextAreaField } from '@/components/dashboard/Field'
import { Spinner, TableSkeleton } from '@/components/dashboard/Loaders'
import { ErrorState } from '@/components/dashboard/States'
import { useToast } from '@/components/dashboard/Toast'
import { api } from '@/lib/api'
import { formatMoney } from '@/lib/money'
import { formatDate } from '@/lib/date'
import { financeRoute } from './financeRoute'
import type { PaymentView } from '@/types/portal'

export function PaymentDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { push } = useToast()
  const { user, hasPermission } = useAuth()
  const base = financeRoute(user?.roles ?? [])

  const canVoid = hasPermission('payments.record')

  const [payment, setPayment] = useState<PaymentView | null>(null)
  const [error, setError] = useState<string | null>(null)

  const [voidOpen, setVoidOpen] = useState(false)
  const [reason, setReason] = useState('')
  const [reasonError, setReasonError] = useState<string | null>(null)
  const [voiding, setVoiding] = useState(false)

  const load = useCallback(async () => {
    if (!id) return
    setError(null)
    try {
      setPayment(await api.getPayment(id))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load the payment.')
    }
  }, [id])

  useEffect(() => {
    void load()
  }, [load])

  const handleVoid = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!id || reason.trim().length < 3) {
      setReasonError('Void reason must be at least 3 characters.')
      return
    }
    setVoiding(true)
    try {
      const updated = await api.voidPayment(id, { reason: reason.trim() })
      setPayment(updated)
      setVoidOpen(false)
      push('success', `${updated.paymentReference} voided.`)
    } catch (err) {
      const apiError = err as { fieldErrors?: Record<string, string> }
      if (apiError.fieldErrors && Object.keys(apiError.fieldErrors).length > 0) {
        setReasonError(apiError.fieldErrors.reason ?? apiError.fieldErrors[Object.keys(apiError.fieldErrors)[0]] ?? null)
      } else {
        push('error', err instanceof Error ? err.message : 'Could not void the payment.')
      }
    } finally {
      setVoiding(false)
    }
  }

  if (error) {
    return (
      <div className="space-y-6">
        <Button variant="ghost-dark" size="sm" to={`${base}/payments`}>
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Back to payments
        </Button>
        <ErrorState message={error} onRetry={() => void load()} />
      </div>
    )
  }

  if (!payment) {
    return (
      <div className="space-y-6">
        <TableSkeleton rows={5} />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Fees & Finance"
        title={payment.paymentReference}
        description={`Payment record for ${payment.pupilName}. Payments are immutable — reversal is only possible by voiding.`}
        actions={
          <>
            <Button variant="ghost-dark" size="sm" to={`${base}/payments`}>
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              Back to payments
            </Button>
            {canVoid && payment.status === 'ACTIVE' ? (
              <Button
                variant="soft"
                onClick={() => {
                  setReason('')
                  setReasonError(null)
                  setVoidOpen(true)
                }}
              >
                <Ban className="h-4 w-4" aria-hidden="true" />
                Void payment
              </Button>
            ) : null}
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Summary */}
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-ink-500">
              <Wallet className="h-5 w-5 text-royal-500" aria-hidden="true" />
              Payment summary
            </h2>
            <Badge tone={payment.status === 'ACTIVE' ? 'green' : 'red'}>
              {payment.status === 'ACTIVE' ? 'Active' : 'Voided'}
            </Badge>
          </div>
          <dl className="mt-5 grid gap-x-6 gap-y-4 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wider text-ink-500">Pupil</dt>
              <dd className="mt-0.5 font-bold text-ink-900">{payment.pupilName}</dd>
              <dd className="text-xs text-ink-500">{payment.pupilCode}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wider text-ink-500">Amount</dt>
              <dd className="mt-0.5 text-lg font-extrabold text-ink-900">{formatMoney(payment.amountPaid)}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wider text-ink-500">Method</dt>
              <dd className="mt-0.5 text-ink-900">{payment.paymentMethod.replace('_', ' ')}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wider text-ink-500">Payment date</dt>
              <dd className="mt-0.5 text-ink-900">{formatDate(payment.paymentDate)}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wider text-ink-500">Received by</dt>
              <dd className="mt-0.5 text-ink-900">{payment.receivedByName}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wider text-ink-500">Recorded</dt>
              <dd className="mt-0.5 text-ink-900">{formatDate(payment.createdAt)}</dd>
            </div>
            {payment.note ? (
              <div className="sm:col-span-2">
                <dt className="text-xs font-semibold uppercase tracking-wider text-ink-500">Note</dt>
                <dd className="mt-0.5 text-ink-700">{payment.note}</dd>
              </div>
            ) : null}
          </dl>
        </Card>

        {/* Allocations */}
        <Card className="p-6">
          <h2 className="text-sm font-bold uppercase tracking-wider text-ink-500">Allocations</h2>
          <p className="mt-1 text-xs text-ink-500">
            How this payment was applied to the pupil’s fee charges.
          </p>
          {payment.allocations.length === 0 ? (
            <p className="mt-4 text-sm text-ink-500">No allocations recorded.</p>
          ) : (
            <ul className="mt-4 space-y-3">
              {payment.allocations.map((allocation) => (
                <li
                  key={allocation.id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-cream-200 bg-cream-50 p-4"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-ink-900">{allocation.feeName}</p>
                    <p className="text-xs text-ink-500">{allocation.termName ?? 'No term'}</p>
                  </div>
                  <span className="shrink-0 font-semibold text-emerald-700">
                    {formatMoney(allocation.amount)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {payment.status === 'VOIDED' ? (
        <Card className="p-6">
          <h2 className="text-sm font-bold uppercase tracking-wider text-ink-500">Void details</h2>
          <dl className="mt-4 grid gap-x-6 gap-y-4 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wider text-ink-500">Voided</dt>
              <dd className="mt-0.5 text-ink-900">{payment.voidedAt ? formatDate(payment.voidedAt) : '—'}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wider text-ink-500">Reason</dt>
              <dd className="mt-0.5 text-ink-900">{payment.voidReason ?? '—'}</dd>
            </div>
          </dl>
        </Card>
      ) : null}

      {/* Void dialog */}
      <Modal
        open={voidOpen}
        onClose={() => setVoidOpen(false)}
        title="Void payment"
        description={`Reversing ${payment.paymentReference} removes its allocations from the pupil’s charges. The record is kept for audit.`}
        size="lg"
      >
        <form onSubmit={handleVoid} noValidate className="space-y-4">
          <TextAreaField
            label="Reason for voiding"
            name="reason"
            value={reason}
            onChange={(event) => {
              setReason(event.target.value)
              setReasonError(null)
            }}
            error={reasonError ?? undefined}
            hint="Explain why this payment is being reversed. This is recorded for audit."
            required
          />
          <div className="flex items-center justify-end gap-2">
            <Button variant="cream" type="button" onClick={() => setVoidOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={voiding}>
              {voiding ? <Spinner className="h-4 w-4" /> : <Ban className="h-4 w-4" aria-hidden="true" />}
              Void payment
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}