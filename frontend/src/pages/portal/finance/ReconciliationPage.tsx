import { useCallback, useEffect, useState } from 'react'
import { ClipboardCheck, DollarSign, Lock, UserCheck, UserX, UserPlus } from 'lucide-react'
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
  currentStatus: ReconciliationStatus
  feeType: 'DAILY' | 'PA'
  disabled: boolean
  onChange: (pupilId: string, paid: boolean) => Promise<void>
}

function StatusToggle({ pupilId, currentStatus, feeType, disabled, onChange }: StatusToggleProps) {
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
      aria-label={`${feeType} fee: ${isPaid ? 'Paid' : 'Not Paid'}. Click to toggle.`}
    >
      {isPaid ? '✓ Paid' : '✕ Not Paid'}
    </Button>
  )
}

interface AttendanceToggleProps {
  pupilId: string
  attendanceStatus: string | null
  disabled: boolean
  onChange: (pupilId: string, present: boolean) => Promise<void>
}

function AttendanceToggle({ pupilId, attendanceStatus, disabled, onChange }: AttendanceToggleProps) {
  const isPresent = attendanceStatus === 'PRESENT'

  return (
    <Button
      variant={isPresent ? 'success' : 'neutral'}
      size="sm"
      onClick={() => !disabled && onChange(pupilId, !isPresent)}
      disabled={disabled}
      className="w-full min-w-[100px]"
      aria-label={`Attendance: ${isPresent ? 'Present' : 'Absent'}. Click to toggle.`}
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
                    attendanceStatus={pupil.attendanceStatus}
                    disabled={!canEditAttendance || isClosed}
                    onChange={onToggleAttendance}
                  />
                </td>
                <td className="px-4 py-3 text-center">
                  <div className="flex flex-col items-center gap-1">
                    <StatusToggle
                      pupilId={pupil.pupilId}
                      currentStatus={pupil.dailyStatus}
                      feeType="DAILY"
                      disabled={!canEditPayments || isClosed}
                      onChange={onToggleDaily}
                    />
                    <span className="text-xs text-ink-500">GHS {formatMoney(pupil.dailyFeeAmount)}</span>
                    {pupil.dailyStatus === 'PAID' && pupil.dailyPaidAmount !== '0.00' && (
                      <span className="text-xs text-emerald-600">Paid: GHS {formatMoney(pupil.dailyPaidAmount)}</span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3 text-center">
                  <div className="flex flex-col items-center gap-1">
                    <StatusToggle
                      pupilId={pupil.pupilId}
                      currentStatus={pupil.paStatus}
                      feeType="PA"
                      disabled={!canEditPayments || isClosed}
                      onChange={onTogglePA}
                    />
                    <span className="text-xs text-ink-500">GHS {formatMoney(pupil.paFeeAmount)}</span>
                    {pupil.paStatus === 'PAID' && pupil.paPaidAmount !== '0.00' && (
                      <span className="text-xs text-emerald-600">Paid: GHS {formatMoney(pupil.paPaidAmount)}</span>
                    )}
                  </div>
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
                  attendanceStatus={pupil.attendanceStatus}
                  disabled={!canEditAttendance || isClosed}
                  onChange={onToggleAttendance}
                />
              </div>
              <div className="p-2 bg-cream-50 rounded-xl">
                <p className="text-xs font-semibold text-ink-500">Daily Fee</p>
                <StatusToggle
                  pupilId={pupil.pupilId}
                  currentStatus={pupil.dailyStatus}
                  feeType="DAILY"
                  disabled={!canEditPayments || isClosed}
                  onChange={onToggleDaily}
                />
                <p className="text-xs text-ink-500">GHS {formatMoney(pupil.dailyFeeAmount)}</p>
              </div>
              <div className="p-2 bg-cream-50 rounded-xl">
                <p className="text-xs font-semibold text-ink-500">PA Fee</p>
                <StatusToggle
                  pupilId={pupil.pupilId}
                  currentStatus={pupil.paStatus}
                  feeType="PA"
                  disabled={!canEditPayments || isClosed}
                  onChange={onTogglePA}
                />
                <p className="text-xs text-ink-500">GHS {formatMoney(pupil.paFeeAmount)}</p>
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
  const { user, hasPermission } = useAuth()
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
    try {
      await api.markPaid({ pupilId, dailyPaid: paid, paPaid: false, paymentMethod: 'CASH' })
      void load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update Daily Fee status.')
    }
  }, [load])

  const handleTogglePA = useCallback(async (pupilId: string, paid: boolean) => {
    try {
      await api.markPaid({ pupilId, dailyPaid: false, paPaid: paid, paymentMethod: 'CASH' })
      void load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update PA Fee status.')
    }
  }, [load])

  const handleToggleAttendance = useCallback(async (pupilId: string, present: boolean) => {
    try {
      const status = present ? 'PRESENT' : 'ABSENT'
      const attendanceRecords = await api.listAttendance({ pupilId, dateFrom: date, dateTo: date })
      const existingRecord = attendanceRecords.find(r => r.pupilId === pupilId && r.date.startsWith(date))
      
      if (existingRecord) {
        await api.updateAttendance(existingRecord.id, { status })
      } else {
        await api.createAttendance({
          pupilId,
          staffId: user?.id ?? '',
          status,
          date,
          sessionId: result?.sessionId ?? '',
        })
      }
      void load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update attendance.')
    }
  }, [load, date, result, user])

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
        description="View and reconcile Daily Fee and PA Fee payment status for all pupils on a single school day."
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

      {error ? (
        <ErrorState message={error} onRetry={() => void load()} />
      ) : loading && !result ? (
        <TableSkeleton rows={6} />
      ) : result ? (
        <>
          {/* Summary stats */}
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
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
          </div>

          {/* Revenue summary */}
          <div className="grid gap-4 sm:grid-cols-3">
            <Card className="p-5">
              <p className="text-xs font-semibold uppercase tracking-wider text-ink-500">Total Outstanding</p>
              <p className="mt-1 text-2xl font-extrabold text-red-700">GHS {formatMoney(result.totals.totalOutstanding)}</p>
              <p className="text-xs text-ink-500">From {result.totals.notPaidCount} unpaid pupils</p>
            </Card>
            <Card className="p-5">
              <p className="text-xs font-semibold uppercase tracking-wider text-ink-500">Fully Paid</p>
              <p className="mt-1 text-2xl font-extrabold text-emerald-700">{result.totals.fullyPaidCount}</p>
              <p className="text-xs text-ink-500">Both fees paid</p>
            </Card>
            <Card className="p-5">
              <p className="text-xs font-semibold uppercase tracking-wider text-ink-500">Partially Paid</p>
              <p className="mt-1 text-2xl font-extrabold text-amber-700">{result.totals.partiallyPaidCount}</p>
              <p className="text-xs text-ink-500">One fee paid, one outstanding</p>
            </Card>
          </div>

          {/* Close / Sign Button */}
          {canEditPayments && !isLocked && (
            <Card className="p-4 border-l-4 border-amber-500 bg-amber-50">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-bold text-ink-900">Close & Sign Daily Fees</p>
                  <p className="text-xs text-ink-500 mt-1">
                    Review all records below, then close and sign this day's reconciliation. After closing, records cannot be edited.
                  </p>
                </div>
                <Button variant="success" onClick={() => setShowCloseDialog(true)}>
                  Close & Sign
                </Button>
              </div>
            </Card>
          )}

          {/* Per-class sections */}
          {result.classes.length === 0 ? (
            <EmptyState
              icon={<ClipboardCheck className="h-7 w-7" aria-hidden="true" />}
              title="No classes found."
              description="No active classes are available for reconciliation."
            />
          ) : (
            <div className="space-y-6">
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
