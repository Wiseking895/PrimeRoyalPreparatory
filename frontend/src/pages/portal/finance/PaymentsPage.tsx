import { useCallback, useEffect, useMemo, useState } from 'react'
import { Eye, Wallet } from 'lucide-react'
import { useAuth } from '@/auth/AuthContext'
import { PageHeader } from '@/components/dashboard/PageHeader'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/dashboard/Badge'
import { TextField, SelectField } from '@/components/dashboard/Field'
import { TableSkeleton } from '@/components/dashboard/Loaders'
import { EmptyState, ErrorState } from '@/components/dashboard/States'
import { api } from '@/lib/api'
import { formatMoney } from '@/lib/money'
import { formatDate, schoolDaysBetween } from '@/lib/date'
import { financeRoute } from './financeRoute'
import type {
  AcademicSessionView,
  AcademicTermView,
  FinanceSummaryView,
  PaymentListResult,
  PaymentMethodValue,
} from '@/types/portal'

const methodOptions: Array<{ value: PaymentMethodValue; label: string }> = [
  { value: 'CASH', label: 'Cash' },
  { value: 'BANK_TRANSFER', label: 'Bank Transfer' },
  { value: 'MOBILE_MONEY', label: 'Mobile Money' },
  { value: 'CHEQUE', label: 'Cheque' },
]

/** History is initially shown in windows of this many school days. */
const HISTORY_WINDOW_DAYS = 7

function dayStartIso(day: string): string {
  return `${day.split('T')[0]}T00:00:00.000Z`
}

function dayEndIso(day: string): string {
  return `${day.split('T')[0]}T23:59:59.999Z`
}

export function PaymentsPage() {
  const { user } = useAuth()
  const base = financeRoute(user?.roles ?? [])

  const [result, setResult] = useState<PaymentListResult | null>(null)
  const [q, setQ] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [methodFilter, setMethodFilter] = useState<string>('')
  const [page, setPage] = useState(1)
  const [error, setError] = useState<string | null>(null)

  // Session / term period for the history view
  const [sessions, setSessions] = useState<AcademicSessionView[]>([])
  const [terms, setTerms] = useState<AcademicTermView[]>([])
  const [selectedSessionId, setSelectedSessionId] = useState<string>('')
  const [selectedTermId, setSelectedTermId] = useState<string>('')
  // Blocks list loads until the session/term period (and its school-day
  // window) is resolved, so the very first render shows School Days 1–7
  // rather than an unfiltered list.
  const [periodReady, setPeriodReady] = useState(false)

  // School-day history window (0 = School Days 1–7 of the selected term)
  const [windowIndex, setWindowIndex] = useState(0)

  const selectedSession = sessions.find((session) => session.id === selectedSessionId) ?? null
  const selectedTerm = terms.find((term) => term.id === selectedTermId) ?? null

  const schoolDays = useMemo(
    () => (selectedTerm ? schoolDaysBetween(selectedTerm.startDate, selectedTerm.endDate) : []),
    [selectedTerm],
  )
  const totalWindows = Math.max(1, Math.ceil(schoolDays.length / HISTORY_WINDOW_DAYS))
  const safeWindowIndex = Math.min(windowIndex, totalWindows - 1)
  const windowDays = schoolDays.slice(
    safeWindowIndex * HISTORY_WINDOW_DAYS,
    safeWindowIndex * HISTORY_WINDOW_DAYS + HISTORY_WINDOW_DAYS,
  )
  const windowLabelStart = safeWindowIndex * HISTORY_WINDOW_DAYS + 1
  const windowLabelEnd = Math.min(safeWindowIndex * HISTORY_WINDOW_DAYS + HISTORY_WINDOW_DAYS, schoolDays.length)

  // Date range for the current history window. Falls back to the full term
  // calendar when the term has no enumerable school days.
  const rangeFrom =
    windowDays.length > 0
      ? dayStartIso(windowDays[0])
      : selectedTerm
        ? dayStartIso(selectedTerm.startDate)
        : undefined
  const rangeTo =
    windowDays.length > 0
      ? dayEndIso(windowDays[windowDays.length - 1])
      : selectedTerm
        ? dayEndIso(selectedTerm.endDate)
        : undefined

  const load = useCallback(async () => {
    if (!periodReady) return
    setError(null)
    try {
      const data = await api.listPayments({
        q: q.trim() || undefined,
        status: statusFilter === 'ACTIVE' || statusFilter === 'VOIDED' ? statusFilter : undefined,
        paymentMethod: methodFilter ? (methodFilter as PaymentMethodValue) : undefined,
        from: rangeFrom,
        to: rangeTo,
        page,
        pageSize: 20,
      })
      setResult(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load payments.')
    }
  }, [q, statusFilter, methodFilter, rangeFrom, rangeTo, page, periodReady])

  useEffect(() => {
    void load()
  }, [load])

  // Resolve the default session/term period once on mount.
  useEffect(() => {
    let cancelled = false
    const bootstrap = async () => {
      let sessionList: AcademicSessionView[] = []
      let summary: FinanceSummaryView | null = null
      try {
        sessionList = await api.listSessions()
      } catch {
        sessionList = []
      }
      try {
        summary = await api.financeSummary()
      } catch {
        summary = null
      }
      if (cancelled) return

      if (summary?.session && !sessionList.some((session) => session.id === summary!.session!.id)) {
        sessionList = [summary.session, ...sessionList]
      }
      setSessions(sessionList)

      const session =
        (summary?.session && sessionList.find((candidate) => candidate.id === summary!.session!.id)) ||
        sessionList.find((candidate) => candidate.status === 'ACTIVE') ||
        sessionList[0] ||
        null
      if (!session) {
        setPeriodReady(true)
        return
      }
      setSelectedSessionId(session.id)

      let termList: AcademicTermView[] = []
      try {
        termList = await api.listTerms(session.id)
      } catch {
        termList = []
      }
      if (cancelled) return
      if (summary?.term && summary.session?.id === session.id && !termList.some((t) => t.id === summary!.term!.id)) {
        termList = [summary.term, ...termList]
      }
      setTerms(termList)

      const term =
        (summary?.term && summary.session?.id === session.id && termList.find((t) => t.id === summary!.term!.id)) ||
        termList.find((candidate) => candidate.status === 'ACTIVE') ||
        termList[0] ||
        null
      if (term) setSelectedTermId(term.id)
      setPeriodReady(true)
    }
    void bootstrap()
    return () => {
      cancelled = true
    }
  }, [])

  const handleSessionChange = async (sessionId: string) => {
    setPeriodReady(false)
    setSelectedSessionId(sessionId)
    setSelectedTermId('')
    setWindowIndex(0)
    setPage(1)
    try {
      const termList = await api.listTerms(sessionId)
      setTerms(termList)
      const term = termList.find((candidate) => candidate.status === 'ACTIVE') || termList[0] || null
      setSelectedTermId(term?.id ?? '')
    } catch {
      setTerms([])
    } finally {
      setPeriodReady(true)
    }
  }

  const handleTermChange = (termId: string) => {
    setSelectedTermId(termId)
    setWindowIndex(0)
    setPage(1)
  }

  const totalPages = result ? Math.max(1, Math.ceil(result.total / result.pageSize)) : 1

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Fees & Finance"
        title="Payment History"
        description="Read-only historical payment transactions recorded against pupil fee charges. Payments are immutable — a payment can only be reversed by voiding it."
      />

      {/* Period: session / term selection + school-day history window */}
      <div className="flex flex-wrap items-end justify-between gap-3 rounded-xl border border-cream-200 bg-cream-50 p-4">
        <div className="flex flex-wrap items-end gap-3">
          <SelectField
            label="Session"
            name="sessionFilter"
            value={selectedSessionId}
            onChange={(event) => {
              void handleSessionChange(event.target.value)
            }}
            options={sessions.map((session) => ({ value: session.id, label: session.name }))}
            placeholder="Select session"
            className="sm:w-44"
          />
          <SelectField
            label="Term"
            name="termFilter"
            value={selectedTermId}
            onChange={(event) => {
              handleTermChange(event.target.value)
            }}
            options={terms.map((term) => ({ value: term.id, label: term.name }))}
            placeholder="Select term"
            className="sm:w-44"
          />
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {selectedSession && selectedTerm ? (
            <p className="text-sm font-bold text-ink-900">
              {selectedSession.name} — {selectedTerm.name}
            </p>
          ) : null}
          {schoolDays.length > 0 ? (
            <>
              <p className="text-xs font-semibold text-ink-500">
                School Days {windowLabelStart}–{windowLabelEnd} of {schoolDays.length}
                {windowDays.length > 0 ? (
                  <span className="text-ink-400">
                    {' · '}
                    {formatDate(windowDays[0])} – {formatDate(windowDays[windowDays.length - 1])}
                  </span>
                ) : null}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="soft"
                  size="sm"
                  ariaLabel="Previous 7 school days"
                  disabled={safeWindowIndex <= 0}
                  onClick={() => {
                    setWindowIndex((current) => Math.max(0, current - 1))
                    setPage(1)
                  }}
                >
                  Previous
                </Button>
                <Button
                  variant="soft"
                  size="sm"
                  ariaLabel="Next 7 school days"
                  disabled={safeWindowIndex >= totalWindows - 1}
                  onClick={() => {
                    setWindowIndex((current) => Math.min(totalWindows - 1, current + 1))
                    setPage(1)
                  }}
                >
                  Next
                </Button>
              </div>
            </>
          ) : null}
        </div>
      </div>

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
              ? 'No payment transactions were recorded in this period.'
              : 'No payments match the selected filters.'
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
    </div>
  )
}
