import { useCallback, useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Eye, Plus, Wallet } from 'lucide-react'
import { useAuth } from '@/auth/AuthContext'
import { PageHeader } from '@/components/dashboard/PageHeader'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/dashboard/Badge'
import { Modal } from '@/components/dashboard/Modal'
import { TextField, SelectField } from '@/components/dashboard/Field'
import { Spinner, TableSkeleton } from '@/components/dashboard/Loaders'
import { EmptyState, ErrorState } from '@/components/dashboard/States'
import { useToast } from '@/components/dashboard/Toast'
import { api } from '@/lib/api'
import { formatMoney, isValidMoney } from '@/lib/money'
import { formatDate } from '@/lib/date'
import { financeRoute } from './financeRoute'
import type { PaymentListResult, PaymentMethodValue } from '@/types/portal'

const methodOptions: Array<{ value: PaymentMethodValue; label: string }> = [
  { value: 'CASH', label: 'Cash' },
  { value: 'BANK_TRANSFER', label: 'Bank Transfer' },
  { value: 'MOBILE_MONEY', label: 'Mobile Money' },
  { value: 'CHEQUE', label: 'Cheque' },
]

interface RecordForm {
  pupilId: string
  pupilLabel: string
  amountPaid: string
  paymentMethod: PaymentMethodValue | ''
  paymentDate: string
  note: string
}

const emptyForm: RecordForm = {
  pupilId: '',
  pupilLabel: '',
  amountPaid: '',
  paymentMethod: '',
  paymentDate: '',
  note: '',
}

export function PaymentsPage() {
  const { push } = useToast()
  const { user, hasPermission } = useAuth()
  const base = financeRoute(user?.roles ?? [])

  const canRecord = hasPermission('payments.record')

  const [result, setResult] = useState<PaymentListResult | null>(null)
  const [q, setQ] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [methodFilter, setMethodFilter] = useState<string>('')
  const [page, setPage] = useState(1)
  const [error, setError] = useState<string | null>(null)

  const [recordOpen, setRecordOpen] = useState(false)
  const [form, setForm] = useState<RecordForm>(emptyForm)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [pupilSearch, setPupilSearch] = useState('')
  const [pupilResults, setPupilResults] = useState<Array<{ id: string; pupilId: string; fullName: string; className: string }>>([])
  const [pupilSearching, setPupilSearching] = useState(false)
  const [pupilSearchError, setPupilSearchError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const load = useCallback(async () => {
    setError(null)
    try {
      const data = await api.listPayments({
        q: q.trim() || undefined,
        status: statusFilter === 'ACTIVE' || statusFilter === 'VOIDED' ? statusFilter : undefined,
        paymentMethod: methodFilter ? (methodFilter as PaymentMethodValue) : undefined,
        page,
        pageSize: 20,
      })
      setResult(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load payments.')
    }
  }, [q, statusFilter, methodFilter, page])

  useEffect(() => {
    void load()
  }, [load])

  const openRecord = () => {
    setForm(emptyForm)
    setFieldErrors({})
    setPupilSearch('')
    setPupilResults([])
    setPupilSearchError(null)
    setRecordOpen(true)
  }

  const runPupilSearch = async () => {
    setPupilSearching(true)
    setPupilSearchError(null)
    try {
      const data = await api.listFinancePupils({ q: pupilSearch.trim() || undefined, pageSize: 20 })
      setPupilResults(data.items)
    } catch (err) {
      setPupilSearchError(err instanceof Error ? err.message : 'Could not search pupils.')
    } finally {
      setPupilSearching(false)
    }
  }

  const set = (field: keyof RecordForm, value: string) => {
    setForm((current) => ({ ...current, [field]: value }))
    setFieldErrors((current) => {
      if (!current[field]) return current
      const next = { ...current }
      delete next[field]
      return next
    })
  }

  const selectPupil = (pupil: { id: string; pupilId: string; fullName: string; className: string }) => {
    setForm((current) => ({ ...current, pupilId: pupil.id, pupilLabel: `${pupil.fullName} · ${pupil.pupilId}` }))
    setPupilSearchError(null)
  }

  const handleRecord = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const errors: Record<string, string> = {}
    if (!form.pupilId) errors.pupilId = 'Select a pupil.'
    if (!isValidMoney(form.amountPaid)) errors.amountPaid = 'Enter a valid amount with up to 2 decimal places.'
    if (!form.paymentMethod) errors.paymentMethod = 'Select a payment method.'
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors)
      return
    }

    setSubmitting(true)
    try {
      const created = await api.createPayment({
        pupilId: form.pupilId,
        amountPaid: form.amountPaid.trim(),
        paymentMethod: form.paymentMethod as PaymentMethodValue,
        paymentDate: form.paymentDate || undefined,
        note: form.note.trim() || undefined,
      })
      setRecordOpen(false)
      setQ('')
      setPage(1)
      await load()
      push('success', `${created.paymentReference} recorded.`)
    } catch (err) {
      const apiError = err as { fieldErrors?: Record<string, string> }
      if (apiError.fieldErrors && Object.keys(apiError.fieldErrors).length > 0) {
        setFieldErrors(apiError.fieldErrors)
      } else {
        push('error', err instanceof Error ? err.message : 'Could not record the payment.')
      }
    } finally {
      setSubmitting(false)
    }
  }

  const totalPages = result ? Math.max(1, Math.ceil(result.total / result.pageSize)) : 1

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Fees & Finance"
        title="Payments"
        description="Payments recorded against pupil fee charges. Payments are immutable — a payment can only be reversed by voiding it."
        actions={
          canRecord ? (
            <Button onClick={openRecord}>
              <Plus className="h-4 w-4" aria-hidden="true" />
              Record payment
            </Button>
          ) : undefined
        }
      />

      <div className="flex flex-wrap items-end gap-3">
        <TextField
          label="Search"
          name="q"
          value={q}
          onChange={(event) => {
            setQ(event.target.value)
            setPage(1)
          }}
          placeholder="Reference or pupil"
          className="sm:w-64"
        />
        <SelectField
          label="Status"
          name="statusFilter"
          value={statusFilter}
          onChange={(event) => {
            setStatusFilter(event.target.value)
            setPage(1)
          }}
          options={[
            { value: 'ACTIVE', label: 'Active' },
            { value: 'VOIDED', label: 'Voided' },
          ]}
          placeholder="All statuses"
          className="sm:w-44"
        />
        <SelectField
          label="Method"
          name="methodFilter"
          value={methodFilter}
          onChange={(event) => {
            setMethodFilter(event.target.value)
            setPage(1)
          }}
          options={methodOptions}
          placeholder="All methods"
          className="sm:w-52"
        />
      </div>

      {error ? (
        <ErrorState message={error} onRetry={() => void load()} />
      ) : result === null ? (
        <TableSkeleton rows={6} />
      ) : result.items.length === 0 ? (
        <EmptyState
          icon={<Wallet className="h-7 w-7" aria-hidden="true" />}
          title="No payments found."
          description={
            result.total === 0
              ? 'Record a payment against a pupil’s outstanding fee charges.'
              : 'No payments match the selected filters.'
          }
          action={
            canRecord && result.total === 0 ? (
              <Button onClick={openRecord}>
                <Plus className="h-4 w-4" aria-hidden="true" />
                Record payment
              </Button>
            ) : undefined
          }
        />
      ) : (
        <Card className="hidden overflow-hidden md:block">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-cream-200 bg-cream-50 text-xs font-bold uppercase tracking-wider text-ink-500">
                <tr>
                  <th scope="col" className="px-5 py-3.5">Reference</th>
                  <th scope="col" className="px-5 py-3.5">Pupil</th>
                  <th scope="col" className="px-5 py-3.5">Amount</th>
                  <th scope="col" className="px-5 py-3.5">Method</th>
                  <th scope="col" className="px-5 py-3.5">Date</th>
                  <th scope="col" className="px-5 py-3.5">Allocations</th>
                  <th scope="col" className="px-5 py-3.5">Status</th>
                  <th scope="col" className="px-5 py-3.5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-cream-200">
                {result.items.map((payment) => (
                  <tr key={payment.id} className="transition-colors hover:bg-cream-50">
                    <td className="px-5 py-3.5 font-semibold text-royal-700">{payment.paymentReference}</td>
                    <td className="px-5 py-3.5">
                      <p className="font-bold text-ink-900">{payment.pupilName}</p>
                      <p className="text-xs text-ink-500">{payment.pupilCode}</p>
                    </td>
                    <td className="px-5 py-3.5 font-semibold text-ink-900">{formatMoney(payment.amountPaid)}</td>
                    <td className="px-5 py-3.5">
                      <Badge tone="neutral">{payment.paymentMethod.replace('_', ' ')}</Badge>
                    </td>
                    <td className="px-5 py-3.5 text-ink-700">{formatDate(payment.paymentDate)}</td>
                    <td className="px-5 py-3.5 text-ink-700">{payment.allocations.length}</td>
                    <td className="px-5 py-3.5">
                      <Badge tone={payment.status === 'ACTIVE' ? 'green' : 'red'}>
                        {payment.status === 'ACTIVE' ? 'Active' : 'Voided'}
                      </Badge>
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex justify-end">
                        <Button variant="soft" size="sm" to={`${base}/payments/${payment.id}`}>
                          <Eye className="h-4 w-4" aria-hidden="true" />
                          View
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Mobile list */}
      {result && result.items.length > 0 ? (
        <ul className="space-y-3 md:hidden">
          {result.items.map((payment) => (
            <li key={payment.id}>
              <Card className="p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-royal-700">{payment.paymentReference}</p>
                    <p className="truncate text-sm text-ink-900">{payment.pupilName}</p>
                    <p className="text-xs text-ink-500">
                      {formatMoney(payment.amountPaid)} · {payment.paymentMethod.replace('_', ' ')} ·{' '}
                      {formatDate(payment.paymentDate)}
                    </p>
                  </div>
                  <Badge tone={payment.status === 'ACTIVE' ? 'green' : 'red'}>
                    {payment.status === 'ACTIVE' ? 'Active' : 'Voided'}
                  </Badge>
                </div>
                <div className="mt-3 flex justify-end border-t border-cream-200 pt-3">
                  <Button variant="soft" size="sm" to={`${base}/payments/${payment.id}`}>
                    <Eye className="h-4 w-4" aria-hidden="true" />
                    View
                  </Button>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      ) : null}

      {/* Pagination */}
      {result && result.total > 0 ? (
        <div className="flex items-center justify-between">
          <p className="text-sm text-ink-500">
            {result.total} payment(s) · page {result.page} of {totalPages}
          </p>
          <div className="flex gap-2">
            <Button variant="soft" size="sm" disabled={page <= 1} onClick={() => setPage((current) => current - 1)}>
              Previous
            </Button>
            <Button
              variant="soft"
              size="sm"
              disabled={!result.hasMore}
              onClick={() => setPage((current) => current + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      ) : null}

      {/* Record payment dialog */}
      <Modal
        open={recordOpen}
        onClose={() => setRecordOpen(false)}
        title="Record payment"
        description="Select a pupil and the amount paid. The payment is allocated to the pupil’s outstanding charges automatically."
        size="lg"
      >
        <form onSubmit={handleRecord} noValidate className="space-y-4">
          {!form.pupilId ? (
            <div className="rounded-xl border border-cream-200 bg-cream-50 p-4">
              <div className="flex gap-2">
                <TextField
                  label="Search pupil"
                  name="pupilSearch"
                  value={pupilSearch}
                  onChange={(event) => setPupilSearch(event.target.value)}
                  placeholder="Name or pupil ID"
                  autoComplete="off"
                  className="flex-1"
                />
                <div className="flex items-end">
                  <Button variant="soft" type="button" onClick={() => void runPupilSearch()} disabled={pupilSearching}>
                    {pupilSearching ? <Spinner className="h-4 w-4" /> : null}
                    Search
                  </Button>
                </div>
              </div>
              {pupilSearchError ? (
                <p role="alert" className="mt-2 text-xs font-medium text-red-600">{pupilSearchError}</p>
              ) : null}
              {pupilResults.length > 0 ? (
                <ul className="mt-3 max-h-56 space-y-2 overflow-y-auto">
                  {pupilResults.map((pupil) => (
                    <li key={pupil.id}>
                      <button
                        type="button"
                        onClick={() => selectPupil(pupil)}
                        className="w-full rounded-xl border border-cream-200 bg-white p-3 text-left transition-colors hover:border-magenta-500"
                      >
                        <span className="block text-sm font-bold text-ink-900">{pupil.fullName}</span>
                        <span className="block text-xs text-ink-500">{pupil.pupilId} · {pupil.className}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : (
            <div className="flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 p-4">
              <div>
                <p className="text-sm font-bold text-ink-900">{form.pupilLabel}</p>
                <p className="text-xs text-ink-500">Selected pupil</p>
              </div>
              <Button
                variant="soft"
                size="sm"
                type="button"
                onClick={() => setForm((current) => ({ ...current, pupilId: '', pupilLabel: '' }))}
              >
                Change
              </Button>
            </div>
          )}
          {fieldErrors.pupilId ? (
            <p role="alert" className="text-xs font-medium text-red-600">{fieldErrors.pupilId}</p>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <TextField
              label="Amount paid"
              name="amountPaid"
              inputMode="decimal"
              value={form.amountPaid}
              onChange={(event) => set('amountPaid', event.target.value)}
              error={fieldErrors.amountPaid}
              hint="Up to 2 decimal places."
              required
              autoComplete="off"
            />
            <SelectField
              label="Payment method"
              name="paymentMethod"
              value={form.paymentMethod}
              onChange={(event) => set('paymentMethod', event.target.value)}
              options={methodOptions}
              placeholder="Select a method"
              error={fieldErrors.paymentMethod}
              required
            />
            <TextField
              label="Payment date"
              name="paymentDate"
              type="date"
              value={form.paymentDate}
              onChange={(event) => set('paymentDate', event.target.value)}
              error={fieldErrors.paymentDate}
              hint="Defaults to today."
            />
            <div className="sm:col-span-2">
              <TextField
                label="Note"
                name="note"
                value={form.note}
                onChange={(event) => set('note', event.target.value)}
                error={fieldErrors.note}
                autoComplete="off"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-2">
            <Button variant="cream" type="button" onClick={() => setRecordOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? <Spinner className="h-4 w-4" /> : null}
              Record payment
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}