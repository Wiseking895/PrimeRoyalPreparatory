import { useCallback, useEffect, useState } from 'react'
import { AlertCircle, CheckCheck, CircleDollarSign, ClipboardCheck, DollarSign, Lock, UserCheck, UserX, UserPlus } from 'lucide-react'
import { PageHeader } from '@/components/dashboard/PageHeader'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/dashboard/Badge'
import { SelectField, TextField } from '@/components/dashboard/Field'
import { Spinner, TableSkeleton } from '@/components/dashboard/Loaders'
import { EmptyState, ErrorState } from '@/components/dashboard/States'
import { StatCard } from '@/components/dashboard/StatCard'
import { api } from '@/lib/api'
import { formatMoney } from '@/lib/money'
import { useAuth } from '@/auth/AuthContext'
import { PAYMENTS_RECORD } from '@/auth/roles'
import type { CombinedReconciliationClassSummary, CombinedReconciliationPupilRow, CombinedReconciliationView, DailyFinanceStatus, ReconciliationStatus } from '@/types/portal'

function todayISO(): string {
  return new Date().toISOString().slice(0, 10)
}

function overallStatusBadge(status: DailyFinanceStatus) {
  switch (status) {
    case 'PAID':
      return <Badge tone="green">Fully Paid</Badge>
    case 'PARTIALLY_PAID':
      return <Badge tone="amber">Partially Paid</Badge>
    case 'NOT_PAID':
      return <Badge tone="red">Not Paid</Badge>
    case 'ABSENT':
      return <Badge tone="neutral">Absent</Badge>
    case 'EXEMPT':
      return <Badge tone="blue">Exempt</Badge>
  }
}

interface StatusToggleProps {
  pupilId: string
  pupilName: string
  currentStatus: ReconciliationStatus
  feeType: 'DAILY' | 'PA'
  disabled: boolean
  onChange: (pupilId: string, paid: boolean) => Promise<void>
}

function StatusToggle({ pupilId, pupilName, currentStatus, feeType, disabled, onChange }: StatusToggleProps) {
  const isPaid = currentStatus === 'PAID'
  const isExempt = currentStatus === 'EXEMPT'

  if (isExempt) {
    return <Badge tone="gold">{feeType} Exempt</Badge>
  }

  return (
    <Button
      variant={isPaid ? 'success' : 'danger'}
      size="sm"
      onClick={() => !disabled && onChange(pupilId, !isPaid)}
      disabled={disabled}
      className="w-full min-w-[100px]"
      ariaLabel={`Mark ${pupilName} ${feeType.toLowerCase()} fee ${isPaid ? 'not paid' : 'paid'}. Click to toggle.`}
    >
      {isPaid ? '✓ Paid' : '✕ Not Paid'}
    </Button>
  )
}

interface AttendanceToggleProps {
  pupilId: string
  pupilName: string
  attendanceStatus: string | null
  disabled: boolean
  onChange: (pupilId: string, present: boolean) => Promise<void>
}

function AttendanceToggle({ pupilId, pupilName, attendanceStatus, disabled, onChange }: AttendanceToggleProps) {
  const isPresent = attendanceStatus === 'PRESENT'

  return (
    <Button
      variant={isPresent ? 'success' : 'danger'}
      size="sm"
      onClick={() => !disabled && onChange(pupilId, !isPresent)}
      disabled={disabled}
      className="w-full min-w-[100px]"
      ariaLabel={`Mark ${pupilName} ${isPresent ? 'absent' : 'present'}. Click to toggle.`}
    >
      {isPresent ? '✓ Present' : '✕ Absent'}
    </Button>
  )
}

function PupilTable({
  pupils,
  canEditPayments,
  canEditAttendance,
  isClosed,
  onToggleDaily,
  onTogglePA,
  onToggleAttendance,
}: {
  pupils: CombinedReconciliationPupilRow[]
  canEditPayments: boolean
  canEditAttendance: boolean
  isClosed: boolean
  onToggleDaily: (pupilId: string, paid: boolean) => Promise<void>
  onTogglePA: (pupilId: string, paid: boolean) => Promise<void>
  onToggleAttendance: (pupilId: string, present: boolean) => Promise<void>
}) {
  return (
    <Card className="hidden overflow-hidden md:block">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-cream-200 bg-cream-50 text-xs font-bold uppercase tracking-wider text-ink-500">
            <tr>
              <th scope="col" className="px-4 py-3 sticky left-0 bg-cream-50 z-10">Pupil</th>
              <th scope="col" className="px-4 py-3 sticky left-0 bg-cream-50 z-10">Class</th>
              <th scope="col" className="px-4 py-3 text-center">Attendance</th>
              <th scope="col" className="px-4 py-3 text-center">Daily Fee</th>
              <th scope="col" className="px-4 py-3 text-center">PA Fee</th>
              <th scope="col" className="px-4 py-3 text-right font-bold">Outstanding</th>
              <th scope="col" className="px-4 py-3 text-center">Overall</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-cream-200">
            {pupils.map((pupil) => (
              <tr key={pupil.pupilId} className="transition-colors hover:bg-cream-50">
                <td className="px-4 py-3 font-bold text-ink-900 whitespace-nowrap">
                  <p>{pupil.fullName}</p>
                  <p className="text-xs text-ink-500">{pupil.pupilCode}</p>
                </td>
                <td className="px-4 py-3 text-ink-700 whitespace-nowrap">{pupil.className}</td>
                <td className="px-4 py-3 text-center">
                  <AttendanceToggle
                    pupilId={pupil.pupilId}
                    pupilName={pupil.fullName}
                    attendanceStatus={pupil.attendanceStatus}
                    disabled={!canEditAttendance || isClosed}
                    onChange={onToggleAttendance}
                  />
                </td>
                <td className="px-4 py-3 text-center">
                  <StatusToggle
                    pupilId={pupil.pupilId}
                    pupilName={pupil.fullName}
                    currentStatus={pupil.dailyStatus}
                    feeType="DAILY"
                    disabled={!canEditPayments || isClosed}
                    onChange={onToggleDaily}
                  />
                </td>
                <td className="px-4 py-3 text-center">
                  <StatusToggle
                    pupilId={pupil.pupilId}
                    pupilName={pupil.fullName}
                    currentStatus={pupil.paStatus}
                    feeType="PA"
                    disabled={!canEditPayments || isClosed}
                    onChange={onTogglePA}
                  />
                </td>
                <td className="px-4 py-3 text-right font-bold">
                  <span className={Number(pupil.outstanding) > 0 ? 'text-red-700' : 'text-ink-900'}>
                    GHS {formatMoney(pupil.outstanding)}
                  </span>
                </td>
                <td className="px-4 py-3 text-center">
                  {overallStatusBadge(pupil.overallStatus)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  )
}

function PupilMobileList({
  pupils,
  canEditPayments,
  canEditAttendance,
  isClosed,
  onToggleDaily,
  onTogglePA,
  onToggleAttendance,
}: {
  pupils: CombinedReconciliationPupilRow[]
  canEditPayments: boolean
  canEditAttendance: boolean
  isClosed: boolean
  onToggleDaily: (pupilId: string, paid: boolean) => Promise<void>
  onTogglePA: (pupilId: string, paid: boolean) => Promise<void>
  onToggleAttendance: (pupilId: string, present: boolean) => Promise<void>
}) {
  return (
    <ul className="space-y-3 md:hidden">
      {pupils.map((pupil) => (
        <li key={pupil.pupilId}>
          <Card className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-ink-900">{pupil.fullName}</p>
                <p className="text-xs text-ink-500">{pupil.pupilCode} · {pupil.className}</p>
              </div>
              {overallStatusBadge(pupil.overallStatus)}
            </div>
            <div className="mt-3 grid grid-cols-3 gap-3 text-center">
              <div className="p-2 bg-cream-50 rounded-xl">
                <p className="text-xs font-semibold text-ink-500">Attendance</p>
                <AttendanceToggle
                  pupilId={pupil.pupilId}
                  pupilName={pupil.fullName}
                  attendanceStatus={pupil.attendanceStatus}
                  disabled={!canEditAttendance || isClosed}
                  onChange={onToggleAttendance}
                />
              </div>
              <div className="p-2 bg-cream-50 rounded-xl">
                <p className="text-xs font-semibold text-ink-500">Daily Fee</p>
                <StatusToggle
                  pupilId={pupil.pupilId}
                  pupilName={pupil.fullName}
                  currentStatus={pupil.dailyStatus}
                  feeType="DAILY"
                  disabled={!canEditPayments || isClosed}
                  onChange={onToggleDaily}
                />
              </div>
              <div className="p-2 bg-cream-50 rounded-xl">
                <p className="text-xs font-semibold text-ink-500">PA Fee</p>
                <StatusToggle
                  pupilId={pupil.pupilId}
                  pupilName={pupil.fullName}
                  currentStatus={pupil.paStatus}
                  feeType="PA"
                  disabled={!canEditPayments || isClosed}
                  onChange={onTogglePA}
                />
              </div>
            </div>
            <div className="mt-3 pt-3 border-t border-cream-200 flex items-center justify-between">
              <span className="text-sm text-ink-500">Outstanding:</span>
              <span className={`font-bold text-lg ${Number(pupil.outstanding) > 0 ? 'text-red-700' : 'text-ink-900'}`}>
                GHS {formatMoney(pupil.outstanding)}
              </span>
            </div>
          </Card>
        </li>
      ))}
    </ul>
  )
}

function ClassSection({
  cls,
  canEditPayments,
  canEditAttendance,
  isClosed,
  onToggleDaily,
  onTogglePA,
  onToggleAttendance,
}: {
  cls: CombinedReconciliationClassSummary
  canEditPayments: boolean
  canEditAttendance: boolean
  isClosed: boolean
  onToggleDaily: (pupilId: string, paid: boolean) => Promise<void>
  onTogglePA: (pupilId: string, paid: boolean) => Promise<void>
  onToggleAttendance: (pupilId: string, present: boolean) => Promise<void>
}) {
  const [expanded, setExpanded] = useState(true)

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        className="flex w-full items-center justify-between rounded-xl border border-cream-200 bg-cream-50 px-5 py-3 text-left transition-colors hover:bg-cream-100"
      >
        <div className="flex items-center gap-4">
          <h3 className="text-sm font-bold text-ink-900">{cls.className}</h3>
          <div className="flex items-center gap-3 text-xs text-ink-500">
            <span>{cls.totalPupils} pupils</span>
            <span className="text-emerald-600 font-semibold">{cls.presentCount} present</span>
            {cls.absentCount > 0 && <span className="text-ink-400">{cls.absentCount} absent</span>}
          </div>
        </div>
        <span className="text-ink-400">{expanded ? '▲' : '▼'}</span>
      </button>

      {expanded && cls.pupils.length > 0 ? (
        <>
          <PupilTable
            pupils={cls.pupils}
            canEditPayments={canEditPayments}
            canEditAttendance={canEditAttendance}
            isClosed={isClosed}
            onToggleDaily={onToggleDaily}
            onTogglePA={onTogglePA}
            onToggleAttendance={onToggleAttendance}
          />
          <PupilMobileList
            pupils={cls.pupils}
            canEditPayments={canEditPayments}
            canEditAttendance={canEditAttendance}
            isClosed={isClosed}
            onToggleDaily={onToggleDaily}
            onTogglePA={onTogglePA}
            onToggleAttendance={onToggleAttendance}
          />
        </>
      ) : null}
    </div>
  )
}

function CloseConfirmationDialog({
  isOpen,
  result,
  onConfirm,
  onCancel,
  closing,
}: {
  isOpen: boolean
  result: CombinedReconciliationView
  onConfirm: () => void
  onCancel: () => void
  closing: boolean
}) {
  if (!isOpen) return null

  const presentPupils = result.totals.presentCount
  const expectedDaily = Number(result.dailyFeeAmount) * presentPupils
  const expectedPa = Number(result.paFeeAmount) * presentPupils

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <Card className="w-full max-w-lg p-6 space-y-4">
        <h2 className="text-lg font-bold text-ink-900">Daily Collection Summary</h2>
        <div className="space-y-2 text-sm text-ink-700">
          <p><span className="font-semibold">Date:</span> {new Date(result.date + 'T00:00:00').toLocaleDateString('en-GB', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
          <p><span className="font-semibold">Registered/Expected Pupils:</span> {result.totals.totalPupils}</p>
          <p><span className="font-semibold">Present:</span> {presentPupils}</p>
          <p><span className="font-semibold">Absent:</span> {result.totals.absentCount}</p>
        </div>
        <div className="border-t border-cream-200 pt-3 space-y-2 text-sm">
          <p className="font-semibold text-ink-900">Daily Fees:</p>
          <p className="ml-4">Expected: GHS {formatMoney(String(expectedDaily))}</p>
          <p className="ml-4">Paid: GHS {formatMoney(result.totals.totalDailyCollected)}</p>
          <p className="ml-4 text-red-700">Outstanding: GHS {formatMoney(String(expectedDaily - Number(result.totals.totalDailyCollected)))}</p>
        </div>
        <div className="border-t border-cream-200 pt-3 space-y-2 text-sm">
          <p className="font-semibold text-ink-900">PA Fees:</p>
          <p className="ml-4">Expected: GHS {formatMoney(String(expectedPa))}</p>
          <p className="ml-4">Paid: GHS {formatMoney(result.totals.totalPaCollected)}</p>
          <p className="ml-4 text-red-700">Outstanding: GHS {formatMoney(String(expectedPa - Number(result.totals.totalPaCollected)))}</p>
        </div>
        <div className="border-t border-cream-200 pt-3">
          <p className="text-sm text-ink-700 italic">
            I confirm that I have checked the attendance, Daily Fee and PA Fee records for this school day and the figures are correct.
          </p>
        </div>
        <div className="flex items-center justify-end gap-3 pt-2">
          <Button variant="outline" onClick={onCancel} disabled={closing}>Cancel</Button>
          <Button variant="success" onClick={onConfirm} disabled={closing}>
            {closing ? <><Spinner className="h-4 w-4" /> Closing...</> : 'Close & Sign Daily Fees'}
          </Button>
        </div>
      </Card>
    </div>
  )
}

export function ReconciliationPage() {
  const { hasPermission } = useAuth()
  const canEditPayments = hasPermission(PAYMENTS_RECORD)
  const canEditAttendance = canEditPayments

  const [date, setDate] = useState(todayISO())
  const [classId, setClassId] = useState('')
  const [q, setQ] = useState('')
  const [result, setResult] = useState<CombinedReconciliationView | null>(null)
  const [classes, setClasses] = useState<Array<{ id: string; name: string }>>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [showCloseDialog, setShowCloseDialog] = useState(false)
  const [closing, setClosing] = useState(false)

  const loadClasses = useCallback(async () => {
    try {
      const all = await api.listClasses()
      setClasses(all.filter((c) => c.status === 'ACTIVE').map((c) => ({ id: c.id, name: c.name })))
    } catch {
      // non-critical
    }
  }, [])

  useEffect(() => {
    void loadClasses()
  }, [loadClasses])

  const load = useCallback(async () => {
    setError(null)
    setLoading(true)
    try {
      const data = await api.getCombinedReconciliation(date, classId || undefined, q.trim() || undefined)
      setResult(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load reconciliation data.')
      setResult(null)
    } finally {
      setLoading(false)
    }
  }, [date, classId, q])

  useEffect(() => {
    void load()
  }, [load])

  const handleToggleDaily = useCallback(async (pupilId: string, paid: boolean) => {
    setError(null)
    try {
      if (paid) {
        await api.markPaid({ pupilId, dailyPaid: true, paPaid: false, paymentMethod: 'CASH', paymentDate: date })
      } else {
        await api.markUnpaid({ pupilId, dailyUnpaid: true, paUnpaid: false, paymentDate: date })
      }
      void load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update Daily Fee status.')
    }
  }, [load, date])

  const handleTogglePA = useCallback(async (pupilId: string, paid: boolean) => {
    setError(null)
    try {
      if (paid) {
        await api.markPaid({ pupilId, dailyPaid: false, paPaid: true, paymentMethod: 'CASH', paymentDate: date })
      } else {
        await api.markUnpaid({ pupilId, dailyUnpaid: false, paUnpaid: true, paymentDate: date })
      }
      void load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update PA Fee status.')
    }
  }, [load, date])

  const handleToggleAttendance = useCallback(async (pupilId: string, present: boolean) => {
    setError(null)
    try {
      const status = present ? 'PRESENT' : 'ABSENT'
      await api.updateReconciliationAttendance({ pupilId, date, status })
      void load()
    } catch (err) {
      // Keep the existing table/result on screen so the prior status stays
      // visible — the failure surfaces as an inline alert, never a fake flip.
      setError(err instanceof Error ? err.message : 'Failed to update attendance.')
    }
  }, [load, date])

  const handleCloseReconciliation = useCallback(async () => {
    setClosing(true)
    try {
      await api.closeDailyReconciliation(date)
      setShowCloseDialog(false)
      void load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to close daily reconciliation.')
    } finally {
      setClosing(false)
    }
  }, [date, load])

  const isLocked = result?.isClosed ?? false

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Fees & Finance"
        title="Daily Reconciliation"
        description="Daily collection and attendance for one school day: Daily Fee and PA Fee paid/not paid status, outstanding balances, then close and sign the day."
      />

      {/* Filters */}
      <Card className="p-4">
        <div className="flex flex-wrap items-end gap-4">
          <TextField
            label="Date"
            name="date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            max={todayISO()}
            className="w-44"
          />
          <SelectField
            label="Class"
            name="classId"
            value={classId}
            onChange={(e) => setClassId(e.target.value)}
            className="w-48"
            options={[
              { value: '', label: 'All Classes' },
              ...classes.map((c) => ({ value: c.id, label: c.name })),
            ]}
          />
          <TextField
            label="Search"
            name="q"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Name or pupil ID"
            className="w-64"
          />
          <Button onClick={() => void load()} disabled={loading}>
            {loading ? <Spinner className="h-4 w-4" /> : null}
            Refresh
          </Button>
        </div>
        {result && (
          <p className="mt-2 text-xs text-ink-500">
            {result.sessionName} · {result.termName} · Daily Fee: GHS {formatMoney(result.dailyFeeAmount)} · PA Fee: GHS {formatMoney(result.paFeeAmount)}
          </p>
        )}
      </Card>

      {/* Closed Day Banner */}
      {isLocked && result && (
        <Card className="p-4 border-l-4 border-emerald-500 bg-emerald-50">
          <div className="flex items-start gap-3">
            <Lock className="h-5 w-5 text-emerald-700 mt-0.5" aria-hidden="true" />
            <div>
              <p className="text-sm font-bold text-emerald-900">✓ Day Closed & Signed</p>
              <p className="text-xs text-emerald-700 mt-1">
                Closed by: {result.closedByName}
              </p>
              <p className="text-xs text-emerald-700">
                Closed at: {result.closedAt ? new Date(result.closedAt).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' }) : '—'}
              </p>
              <p className="text-xs text-emerald-600 mt-2 italic">
                This day's financial reconciliation is locked.
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* Load failure with no data → full error state; mutation failure with
          data on screen → inline alert so the table and prior statuses remain. */}
      {error && !result ? (
        <ErrorState message={error} onRetry={() => void load()} />
      ) : loading && !result ? (
        <TableSkeleton rows={6} />
      ) : result ? (
        <>
          {error && (
            <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">
              {error}
            </div>
          )}
          {/* Per-class sections */}
          {result.classes.length === 0 ? (
            <EmptyState
              icon={<ClipboardCheck className="h-7 w-7" aria-hidden="true" />}
              title="No classes found."
              description="No active classes are available for reconciliation."
            />
          ) : (
            <div className="space-y-6" data-testid="reconciliation-classes">
              {result.classes.map((cls) => (
                <ClassSection
                  key={cls.classId}
                  cls={cls}
                  canEditPayments={canEditPayments}
                  canEditAttendance={canEditAttendance}
                  isClosed={isLocked}
                  onToggleDaily={handleToggleDaily}
                  onTogglePA={handleTogglePA}
                  onToggleAttendance={handleToggleAttendance}
                />
              ))}
            </div>
          )}

          {/* Summary stats */}
          <div data-testid="reconciliation-summary" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="Total Pupils"
              value={result.totals.totalPupils}
              icon={<ClipboardCheck className="h-5 w-5" aria-hidden="true" />}
              tone="royal"
            />
            <StatCard
              label="Present"
              value={result.totals.presentCount}
              icon={<UserCheck className="h-5 w-5" aria-hidden="true" />}
              tone="green"
            />
            <StatCard
              label="Absent"
              value={result.totals.absentCount}
              icon={<UserX className="h-5 w-5" aria-hidden="true" />}
              tone="neutral"
            />
            <StatCard
              label="Daily Collected"
              value={`GHS ${formatMoney(result.totals.totalDailyCollected)}`}
              hint={`${result.totals.dailyPaidCount} paid · ${result.totals.dailyNotPaidCount} unpaid`}
              icon={<DollarSign className="h-5 w-5" aria-hidden="true" />}
              tone="blue"
            />
            <StatCard
              label="PA Collected"
              value={`GHS ${formatMoney(result.totals.totalPaCollected)}`}
              hint={`${result.totals.paPaidCount} paid · ${result.totals.paNotPaidCount} unpaid`}
              icon={<UserPlus className="h-5 w-5" aria-hidden="true" />}
              tone="magenta"
            />
            <StatCard
              label="Fully Paid"
              value={result.totals.fullyPaidCount}
              hint="Both fees paid"
              icon={<CheckCheck className="h-5 w-5" aria-hidden="true" />}
              tone="green"
            />
            <StatCard
              label="Partially Paid"
              value={result.totals.partiallyPaidCount}
              hint="One fee paid, one outstanding"
              icon={<CircleDollarSign className="h-5 w-5" aria-hidden="true" />}
              tone="gold"
            />
            <StatCard
              label="Total Outstanding"
              value={`GHS ${formatMoney(result.totals.totalOutstanding)}`}
              hint={`From ${result.totals.notPaidCount} unpaid pupils`}
              icon={<AlertCircle className="h-5 w-5" aria-hidden="true" />}
              tone="red"
            />
          </div>

          {/* Close / Sign Button */}
          {canEditPayments && !isLocked && (
            <div className="flex flex-col gap-3 rounded-xl border border-cream-200 bg-cream-50 p-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-ink-500">
                Review all records above, then close and sign this day's reconciliation. After closing, records cannot be edited.
              </p>
              <div className="flex justify-end">
                <Button variant="success" size="lg" onClick={() => setShowCloseDialog(true)}>
                  Close &amp; Sign
                </Button>
              </div>
            </div>
          )}
        </>
      ) : null}

      {/* Close Confirmation Dialog */}
      {result && (
        <CloseConfirmationDialog
          isOpen={showCloseDialog}
          result={result}
          onConfirm={() => void handleCloseReconciliation()}
          onCancel={() => setShowCloseDialog(false)}
          closing={closing}
        />
      )}
    </div>
  )
}
