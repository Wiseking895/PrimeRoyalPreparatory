import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  BookOpenCheck,
  CalendarDays,
  CheckCircle2,
  Clock,
  ClipboardList,
  GraduationCap,
  TrendingUp,
  Users,
  Wallet,
  XCircle,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/auth/AuthContext'
import { api } from '@/lib/api'
import { cn } from '@/lib/cn'
import { formatDate } from '@/lib/date'
import { formatMoney } from '@/lib/money'
import type {
  AcademicSessionView,
  AcademicStatsView,
  AcademicTermView,
  AttendanceView,
  OwnerFinanceOverviewView,
  PupilStats,
  StaffView,
  TeacherListRow,
} from '@/types/portal'

function todayStr(): string {
  return new Date().toISOString().slice(0, 10)
}

type FeeCategory = 'daily' | 'pa' | 'maintenance'

function GlassCard({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('glass-card p-5', className)}>
      {children}
    </div>
  )
}

function GlassInnerCard({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('glass-card-inner p-4', className)}>
      {children}
    </div>
  )
}

function KpiCard({
  icon: Icon,
  label,
  value,
  accent,
  supporting,
}: {
  icon: typeof Users
  label: string
  value: string | number
  accent?: boolean
  supporting?: string
}) {
  return (
    <GlassCard>
      <div className="flex items-start gap-3">
        <span
          className={cn(
            'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl',
            accent
              ? 'bg-magenta-500/20 text-magenta-300'
              : 'bg-white/[0.06] text-cream-200/70',
          )}
        >
          <Icon className="h-5 w-5" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-bold uppercase tracking-wider text-cream-200/60">{label}</p>
          <p className={cn('mt-1 text-2xl font-extrabold tracking-tight', accent ? 'text-magenta-300' : 'text-white')}>
            {value}
          </p>
          {supporting && <p className="mt-1 text-[11px] text-cream-200/60">{supporting}</p>}
        </div>
      </div>
    </GlassCard>
  )
}

function SkeletonRow() {
  return (
    <div className="animate-pulse flex items-center gap-4 rounded-xl bg-white/[0.03] p-3">
      <div className="h-4 w-24 rounded bg-white/[0.06]" />
      <div className="h-4 w-12 rounded bg-white/[0.06]" />
      <div className="h-4 w-12 rounded bg-white/[0.06]" />
      <div className="h-4 w-12 rounded bg-white/[0.06]" />
    </div>
  )
}

function EmptyStateCard({ title, description }: { title: string; description?: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-white/[0.08] bg-white/[0.02] px-6 py-12 text-center">
      <p className="text-sm font-semibold text-cream-200/70">{title}</p>
      {description && <p className="mt-1 text-[12px] text-cream-200/60">{description}</p>}
    </div>
  )
}

function SectionHeader({
  title,
  icon: Icon,
  action,
}: {
  title: string
  icon: typeof Users
  action?: React.ReactNode
}) {
  return (
    <div className="flex items-center justify-between mb-4">
      <div className="flex items-center gap-2.5">
        <Icon className="h-4 w-4 text-magenta-400/60" aria-hidden="true" />
        <h2 className="text-sm font-bold text-cream-100">{title}</h2>
      </div>
      {action}
    </div>
  )
}

export function HeadteacherDashboardPage() {
  const { hasPermission } = useAuth()
  const [staff, setStaff] = useState<StaffView[] | null>(null)
  const [finance, setFinance] = useState<OwnerFinanceOverviewView | null>(null)
  const [academic, setAcademic] = useState<AcademicStatsView | null>(null)
  const [sessions, setSessions] = useState<AcademicSessionView[] | null>(null)
  const [terms, setTerms] = useState<AcademicTermView[] | null>(null)
  const [teachers, setTeachers] = useState<TeacherListRow[] | null>(null)
  const [attendance, setAttendance] = useState<AttendanceView[] | null>(null)
  const [pupilStats, setPupilStats] = useState<PupilStats | null>(null)
  const [activeCategory, setActiveCategory] = useState<FeeCategory>('daily')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [sectionErrors, setSectionErrors] = useState<Record<string, string>>({})

  const canViewPupils = hasPermission('pupils.view')
  const canViewFinance = hasPermission('finance.view')
  const canViewAcademic = hasPermission('academic.view')
  const canViewTeachers = hasPermission('teachers.view')
  const canViewAttendance = hasPermission('attendance.view')

  const load = useCallback(async () => {
    setError(null)
    setSectionErrors({})
    setLoading(true)
    try {
      const today = todayStr()
      const results = await Promise.allSettled([
        api.listStaff(),
        canViewFinance ? api.financeOverview() : Promise.resolve(null),
        canViewAcademic ? api.academicStats() : Promise.resolve(null),
        canViewTeachers ? api.listTeachers() : Promise.resolve(null),
        canViewAttendance ? api.listAttendance({ dateFrom: today, dateTo: today }) : Promise.resolve(null),
        canViewPupils ? api.pupilStats() : Promise.resolve(null),
        canViewAcademic ? api.listSessions() : Promise.resolve(null),
        canViewAcademic ? api.listTerms() : Promise.resolve(null),
      ])

      const settled = <T,>(index: number): { ok: true; value: T | null } | { ok: false; message: string } => {
        const result = results[index]
        if (result.status === 'fulfilled') return { ok: true, value: result.value as T | null }
        return {
          ok: false,
          message: result.reason instanceof Error ? result.reason.message : 'Request failed.',
        }
      }

      const recordSectionError = (key: string, message: string) => {
        setSectionErrors((current) => ({ ...current, [key]: message }))
      }

      const staffResult = settled<StaffView[]>(0)
      if (staffResult.ok) setStaff(staffResult.value)
      else recordSectionError('staff', staffResult.message)

      const financeResult = settled<OwnerFinanceOverviewView>(1)
      if (financeResult.ok) setFinance(financeResult.value)
      else recordSectionError('finance', financeResult.message)

      const academicResult = settled<AcademicStatsView>(2)
      if (academicResult.ok) setAcademic(academicResult.value)
      else recordSectionError('academic', academicResult.message)

      const teachersResult = settled<TeacherListRow[]>(3)
      if (teachersResult.ok) setTeachers(teachersResult.value ?? [])
      else recordSectionError('teachers', teachersResult.message)

      const attendanceResult = settled<AttendanceView[]>(4)
      if (attendanceResult.ok) setAttendance(attendanceResult.value ?? [])
      else recordSectionError('attendance', attendanceResult.message)

      const pupilStatsResult = settled<PupilStats>(5)
      if (pupilStatsResult.ok) {
        setPupilStats(pupilStatsResult.value)
      } else if (canViewPupils) {
        setError(pupilStatsResult.message)
      }

      const sessionsResult = settled<AcademicSessionView[]>(6)
      if (sessionsResult.ok) setSessions(sessionsResult.value)
      else recordSectionError('academicPeriod', sessionsResult.message)

      const termsResult = settled<AcademicTermView[]>(7)
      if (termsResult.ok) setTerms(termsResult.value)
      else recordSectionError('academicPeriod', termsResult.message)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load the dashboard.')
    } finally {
      setLoading(false)
    }
  }, [canViewPupils, canViewFinance, canViewAcademic, canViewTeachers, canViewAttendance])

  useEffect(() => {
    void load()
  }, [load])

  const teachersPresent = teachers ? teachers.filter((t) => t.status === 'ACTIVE').length : 0
  const teachersInactive = teachers ? teachers.filter((t) => t.status === 'INACTIVE').length : 0

  const attendanceByClass = useMemo(() => {
    if (!pupilStats) return []
    const records = attendance ?? []
    return pupilStats.byClass.map((cls) => {
      const classAttendance = records.filter((a) => a.classId === cls.classId)
      const present = classAttendance.filter((a) => a.status === 'PRESENT' || a.status === 'CHECKED_IN').length
      const absent = classAttendance.filter((a) => a.status === 'ABSENT').length
      return {
        classId: cls.classId,
        className: cls.className,
        totalPupils: cls.count,
        present,
        absent,
        attendancePct: cls.count > 0 ? Math.round((present / cls.count) * 100) : 0,
      }
    })
  }, [pupilStats, attendance])

  const totalPresent = attendanceByClass.reduce((s, c) => s + c.present, 0)
  const totalAbsent = attendanceByClass.reduce((s, c) => s + c.absent, 0)
  const totalPupilsInClasses = attendanceByClass.reduce((s, c) => s + c.totalPupils, 0)
  const overallAttendancePct = totalPupilsInClasses > 0 ? Math.round((totalPresent / totalPupilsInClasses) * 100) : 0

  const activeClassCount = useMemo(() => {
    if (!finance) return 0
    const ids = new Set<string>()
    for (const row of [...finance.dailyFees, ...finance.maintenanceFees]) {
      ids.add(row.classId)
    }
    return ids.size
  }, [finance])

  const activeSession = useMemo(() => {
    if (!sessions) return null
    return sessions.find((entry) => entry.status === 'ACTIVE') ?? sessions[0] ?? null
  }, [sessions])

  const activeTerm = useMemo(() => {
    if (!terms) return null
    const inSession = activeSession ? terms.filter((entry) => entry.sessionId === activeSession.id) : terms
    return inSession.find((entry) => entry.status === 'ACTIVE') ?? inSession[0] ?? null
  }, [terms, activeSession])

  const collectionPct = useMemo(() => {
    if (!finance) return 0
    const exp = Number(finance.totals.totalExpected)
    const col = Number(finance.totals.totalCollected)
    if (exp <= 0) return 0
    return Math.round((col / exp) * 100)
  }, [finance])

  const activeFeeRows = useMemo(() => {
    if (!finance) return []
    if (activeCategory === 'daily') return finance.dailyFees
    if (activeCategory === 'pa') return finance.paFees
    return finance.maintenanceFees
  }, [finance, activeCategory])

  const activeFeeTotals = useMemo(() => {
    if (!finance) return { expected: '0.00', collected: '0.00', outstanding: '0.00' }
    if (activeCategory === 'daily') return { expected: finance.totals.totalExpected, collected: finance.totals.totalCollected, outstanding: finance.totals.totalOutstanding }
    const rows = activeFeeRows
    const exp = rows.reduce((s, r) => s + Number(r.expectedAmount), 0)
    const col = rows.reduce((s, r) => s + Number(r.collectedAmount), 0)
    return { expected: exp.toFixed(2), collected: col.toFixed(2), outstanding: (exp - col).toFixed(2) }
  }, [finance, activeCategory, activeFeeRows])

  const activeAttendanceTotals = useMemo(() => {
    return activeFeeRows.reduce(
      (acc, row) => ({
        boysPresent: acc.boysPresent + row.boysPresent,
        boysAbsent: acc.boysAbsent + row.boysAbsent,
        girlsPresent: acc.girlsPresent + row.girlsPresent,
        girlsAbsent: acc.girlsAbsent + row.girlsAbsent,
      }),
      { boysPresent: 0, boysAbsent: 0, girlsPresent: 0, girlsAbsent: 0 },
    )
  }, [activeFeeRows])
  const activeTotalPresent = activeAttendanceTotals.boysPresent + activeAttendanceTotals.girlsPresent
  const activeTotalAbsent = activeAttendanceTotals.boysAbsent + activeAttendanceTotals.girlsAbsent
  const activeGrandTotal = activeTotalPresent + activeTotalAbsent

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-red-500/20 bg-red-500/[0.06] px-6 py-12 text-center">
        <p className="text-sm font-bold text-red-300">{error}</p>
        <button
          type="button"
          onClick={() => void load()}
          className="mt-4 rounded-full bg-magenta-500 px-5 py-2 text-sm font-semibold text-white hover:bg-magenta-600"
        >
          Try again
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* ── School Snapshot KPIs ── */}
      <SectionHeader title="School Snapshot — Today" icon={TrendingUp} />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          icon={Users}
          label="Total Pupils"
          value={pupilStats ? pupilStats.total : '—'}
          accent
          supporting={
            pupilStats
              ? `${pupilStats.active} active · ${pupilStats.inactive} inactive`
              : loading
                ? 'Loading...'
                : 'Unavailable'
          }
        />
        <KpiCard
          icon={GraduationCap}
          label="Teachers Present"
          value={academic ? teachersPresent : '—'}
          supporting={academic ? `${academic.teachers.total} total staff` : 'Loading...'}
        />
        <KpiCard
          icon={BookOpenCheck}
          label="Active Pupils"
          value={pupilStats ? pupilStats.active : '—'}
          supporting={
            pupilStats ? `${pupilStats.inactive} inactive` : loading ? 'Loading...' : 'Unavailable'
          }
        />
        <KpiCard
          icon={ClipboardList}
          label="Work Output"
          value={academic ? 'View' : '—'}
          accent
          supporting={canViewTeachers ? 'Teacher submissions pending review' : 'Loading...'}
        />
      </div>

      {/* ── Academic Period ── */}
      {canViewAcademic && (
        <GlassCard>
          <SectionHeader
            title="Academic Period"
            icon={CalendarDays}
            action={
              <Link
                to="/headteacher/finance/sessions"
                className="text-[12px] font-semibold text-magenta-400 hover:text-magenta-300"
              >
                Manage academic years &rarr;
              </Link>
            }
          />
          {sectionErrors.academicPeriod ? (
            <EmptyStateCard
              title="Could not load the academic period."
              description={sectionErrors.academicPeriod}
            />
          ) : sessions === null || terms === null ? (
            <div className="space-y-2">{Array.from({ length: 2 }).map((_, i) => <SkeletonRow key={i} />)}</div>
          ) : !activeSession && !activeTerm ? (
            <EmptyStateCard
              title="No academic year configured."
              description="Create an academic year and term to start billing fees."
            />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              <GlassInnerCard>
                <p className="text-[11px] font-bold uppercase tracking-wider text-cream-200/60">Academic Year</p>
                <p className="mt-1 text-base font-extrabold text-cream-100">
                  {activeSession?.name ?? 'No active academic year'}
                </p>
                {activeSession && (
                  <p className="mt-1 text-[12px] text-cream-200/60">
                    {formatDate(activeSession.startDate)} — {formatDate(activeSession.endDate)} ·{' '}
                    {activeSession.termCount} term{activeSession.termCount === 1 ? '' : 's'}
                  </p>
                )}
              </GlassInnerCard>
              <GlassInnerCard>
                <p className="text-[11px] font-bold uppercase tracking-wider text-cream-200/60">Term</p>
                <p className="mt-1 text-base font-extrabold text-cream-100">
                  {activeTerm?.name ?? 'No active term'}
                </p>
                {activeTerm && (
                  <p className="mt-1 text-[12px] text-cream-200/60">
                    {formatDate(activeTerm.startDate)} — {formatDate(activeTerm.endDate)} ·{' '}
                    {activeTerm.schoolDays} school days
                  </p>
                )}
              </GlassInnerCard>
            </div>
          )}
        </GlassCard>
      )}

      {/* ── Attendance by Class ── */}
      <GlassCard>
        <SectionHeader
          title="Attendance by Class"
          icon={Clock}
          action={
            <span className="text-[11px] font-semibold text-cream-200/65">
              {new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' })}
            </span>
          }
        />
        {!canViewAttendance ? (
          <EmptyStateCard title="Access restricted." />
        ) : sectionErrors.attendance ? (
          <EmptyStateCard title="Could not load attendance." description={sectionErrors.attendance} />
        ) : !pupilStats || attendance === null ? (
          <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <SkeletonRow key={i} />)}</div>
        ) : attendanceByClass.length === 0 ? (
          <EmptyStateCard title="No attendance data available for today." description="Attendance records will appear here once checked in." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[13px]">
              <thead>
                <tr className="border-b border-white/[0.06]">
                  <th className="pb-2 pr-3 text-[11px] font-bold uppercase tracking-wider text-cream-200/60">Class</th>
                  <th className="pb-2 pr-3 text-[11px] font-bold uppercase tracking-wider text-cream-200/60 text-right">Boys Present</th>
                  <th className="pb-2 pr-3 text-[11px] font-bold uppercase tracking-wider text-cream-200/60 text-right">Boys Absent</th>
                  <th className="pb-2 pr-3 text-[11px] font-bold uppercase tracking-wider text-cream-200/60 text-right">Girls Present</th>
                  <th className="pb-2 pr-3 text-[11px] font-bold uppercase tracking-wider text-cream-200/60 text-right">Girls Absent</th>
                  <th className="pb-2 pr-3 text-[11px] font-bold uppercase tracking-wider text-cream-200/60 text-right">Total Present</th>
                  <th className="pb-2 pr-3 text-[11px] font-bold uppercase tracking-wider text-cream-200/60 text-right">Total Absent</th>
                  <th className="pb-2 text-[11px] font-bold uppercase tracking-wider text-cream-200/60 text-right">Attendance %</th>
                </tr>
              </thead>
              <tbody>
                {attendanceByClass.map((cls) => (
                  <tr key={cls.className} className="border-b border-white/[0.04]">
                    <td className="py-2.5 pr-3 font-semibold text-cream-100">{cls.className}</td>
                    <td className="py-2.5 pr-3 text-right text-cream-200/60">{cls.present}</td>
                    <td className="py-2.5 pr-3 text-right text-cream-200/60">{cls.absent}</td>
                    <td className="py-2.5 pr-3 text-right text-cream-200/60">{cls.present}</td>
                    <td className="py-2.5 pr-3 text-right text-cream-200/60">{cls.absent}</td>
                    <td className="py-2.5 pr-3 text-right font-bold text-emerald-400">{cls.present}</td>
                    <td className="py-2.5 pr-3 text-right font-bold text-red-400">{cls.absent}</td>
                    <td className="py-2.5 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <div className="h-1.5 w-16 overflow-hidden rounded-full bg-white/10">
                          <div
                            className={cn(
                              'h-full rounded-full transition-all',
                              cls.attendancePct >= 80 ? 'bg-emerald-400' : cls.attendancePct >= 50 ? 'bg-amber-400' : 'bg-red-400',
                            )}
                            style={{ width: `${cls.attendancePct}%` }}
                          />
                        </div>
                        <span className="text-[11px] font-bold text-cream-200/60 w-8 text-right">{cls.attendancePct}%</span>
                      </div>
                    </td>
                  </tr>
                ))}
                <tr className="border-t border-magenta-500/20">
                  <td className="pt-3 pr-3 text-[12px] font-bold text-magenta-300">Grand Total</td>
                  <td className="pt-3 pr-3 text-right text-[12px] font-bold text-magenta-300">{totalPresent}</td>
                  <td className="pt-3 pr-3 text-right text-[12px] font-bold text-magenta-300">{totalAbsent}</td>
                  <td className="pt-3 pr-3 text-right text-[12px] font-bold text-magenta-300">{totalPresent}</td>
                  <td className="pt-3 pr-3 text-right text-[12px] font-bold text-magenta-300">{totalAbsent}</td>
                  <td className="pt-3 pr-3 text-right text-[12px] font-extrabold text-magenta-300">{totalPresent}</td>
                  <td className="pt-3 pr-3 text-right text-[12px] font-extrabold text-magenta-300">{totalAbsent}</td>
                  <td className="pt-3 text-right text-[12px] font-extrabold text-magenta-300">{overallAttendancePct}%</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </GlassCard>

      {/* ── Finance Overview ── */}
      {canViewFinance && (
        <GlassCard>
          <SectionHeader
            title="Finance Overview"
            icon={Wallet}
            action={
              <div className="flex items-center gap-3">
                {finance?.term && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.05] px-3 py-1 text-[11px] font-semibold text-cream-200/70 ring-1 ring-white/[0.08]">
                    <Clock className="h-3 w-3" aria-hidden="true" />
                    {finance.term.name}
                  </span>
                )}
                {finance?.session && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.05] px-3 py-1 text-[11px] font-semibold text-cream-200/70 ring-1 ring-white/[0.08]">
                    {finance.session.name}
                  </span>
                )}
                <Link
                  to="/headteacher/finance"
                  className="text-[12px] font-semibold text-magenta-400 hover:text-magenta-300"
                >
                  View details &rarr;
                </Link>
              </div>
            }
          />
          {!finance ? (
            sectionErrors.finance ? (
              <EmptyStateCard title="Could not load finance overview." description={sectionErrors.finance} />
            ) : (
              <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <SkeletonRow key={i} />)}</div>
            )
          ) : (
            <>
              {/* KPI strip */}
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 mb-4">
                <GlassInnerCard>
                  <p className="text-[11px] font-bold uppercase tracking-wider text-cream-200/60">Total Expected</p>
                  <p className="mt-1 text-xl font-extrabold text-cream-100">{formatMoney(finance.totals.totalExpected)}</p>
                  <p className="text-[11px] text-cream-200/60">{finance.totals.pupilsWithCharges} pupils with charges</p>
                </GlassInnerCard>
                <GlassInnerCard>
                  <p className="text-[11px] font-bold uppercase tracking-wider text-cream-200/60">Total Collected</p>
                  <p className="mt-1 text-xl font-extrabold text-emerald-400">{formatMoney(finance.totals.totalCollected)}</p>
                  <p className="text-[11px] text-cream-200/60">{finance.totals.pupilsWithPayments} pupils have paid</p>
                  <div className="mt-2 flex items-center gap-2">
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/[0.08]">
                      <div className="h-full rounded-full bg-gradient-to-r from-magenta-500 to-pink-400" style={{ width: `${collectionPct}%` }} />
                    </div>
                    <span className="text-[11px] font-bold text-cream-200/70 w-8 text-right">{collectionPct}%</span>
                  </div>
                </GlassInnerCard>
                <GlassInnerCard>
                  <p className="text-[11px] font-bold uppercase tracking-wider text-cream-200/60">Outstanding</p>
                  <p className="mt-1 text-xl font-extrabold text-red-400">{formatMoney(finance.totals.totalOutstanding)}</p>
                  <p className="text-[11px] text-cream-200/60">{collectionPct}% collection rate</p>
                </GlassInnerCard>
                <GlassInnerCard>
                  <p className="text-[11px] font-bold uppercase tracking-wider text-cream-200/60">Active Classes</p>
                  <p className="mt-1 text-xl font-extrabold text-cream-100">{activeClassCount}</p>
                  <p className="text-[11px] text-cream-200/60">{finance.totals.totalPupils} total active pupils</p>
                </GlassInnerCard>
              </div>

              {/* Fee table + Outstanding Arrears (2-col grid) */}
              <div className="grid gap-6 lg:grid-cols-3 mb-4">
                <div className="lg:col-span-2">
                  {/* Fee type toggle */}
                  <div className="mb-3 flex gap-2">
                    {([['daily', 'Daily Fees'], ['pa', 'PA Fees'], ['maintenance', 'Maintenance Fees']] as const).map(([key, label]) => (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setActiveCategory(key)}
                        className={cn(
                          'rounded-full px-3 py-1 text-[11px] font-semibold transition-colors',
                          activeCategory === key
                            ? 'bg-magenta-500/20 text-magenta-300 ring-1 ring-magenta-500/30'
                            : 'bg-white/[0.05] text-cream-200/65 hover:bg-white/[0.08] hover:text-cream-200/60',
                        )}
                      >
                        {label}
                      </button>
                    ))}
                  </div>

                  {activeFeeRows.length === 0 ? (
                    <p className="text-[12px] text-cream-200/60 py-4 text-center">No {activeCategory === 'daily' ? 'daily' : activeCategory === 'pa' ? 'PA' : 'maintenance'} fee data for this term.</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-[13px]">
                        <thead>
                          <tr className="border-b border-white/[0.06]">
                            <th className="pb-2 pr-4 text-[11px] font-bold uppercase tracking-wider text-cream-200/60">Class</th>
                            <th className="pb-2 pr-4 text-[11px] font-bold uppercase tracking-wider text-cream-200/60 text-right">Boys Present</th>
                            <th className="pb-2 pr-4 text-[11px] font-bold uppercase tracking-wider text-cream-200/60 text-right">Boys Absent</th>
                            <th className="pb-2 pr-4 text-[11px] font-bold uppercase tracking-wider text-cream-200/60 text-right">Girls Present</th>
                            <th className="pb-2 pr-4 text-[11px] font-bold uppercase tracking-wider text-cream-200/60 text-right">Girls Absent</th>
                            <th className="pb-2 pr-4 text-[11px] font-bold uppercase tracking-wider text-cream-200/60 text-right">Total Present</th>
                            <th className="pb-2 pr-4 text-[11px] font-bold uppercase tracking-wider text-cream-200/60 text-right">Total Absent</th>
                            <th className="pb-2 pr-4 text-[11px] font-bold uppercase tracking-wider text-cream-200/60 text-right">Grand Total</th>
                            <th className="pb-2 pr-4 text-[11px] font-bold uppercase tracking-wider text-cream-200/60 text-right">Expected</th>
                            <th className="pb-2 pr-4 text-[11px] font-bold uppercase tracking-wider text-cream-200/60 text-right">Collected</th>
                            <th className="pb-2 text-[11px] font-bold uppercase tracking-wider text-cream-200/60 text-right">Outstanding</th>
                          </tr>
                        </thead>
                        <tbody>
                          {activeFeeRows.map((row) => {
                            const rowTotalPresent = row.boysPresent + row.girlsPresent
                            const rowTotalAbsent = row.boysAbsent + row.girlsAbsent
                            return (
                              <tr key={row.classId} className="border-b border-white/[0.04]">
                                <td className="py-2.5 pr-4 font-semibold text-cream-100">{row.className}</td>
                                <td className="py-2.5 pr-4 text-right text-cream-200/60">{row.boysPresent}</td>
                                <td className="py-2.5 pr-4 text-right text-cream-200/60">{row.boysAbsent}</td>
                                <td className="py-2.5 pr-4 text-right text-cream-200/60">{row.girlsPresent}</td>
                                <td className="py-2.5 pr-4 text-right text-cream-200/60">{row.girlsAbsent}</td>
                                <td className="py-2.5 pr-4 text-right font-semibold text-emerald-400">{rowTotalPresent}</td>
                                <td className="py-2.5 pr-4 text-right font-semibold text-red-400">{rowTotalAbsent}</td>
                                <td className="py-2.5 pr-4 text-right text-cream-200/60">{rowTotalPresent + rowTotalAbsent}</td>
                                <td className="py-2.5 pr-4 text-right text-cream-200/60">{formatMoney(row.expectedAmount)}</td>
                                <td className="py-2.5 pr-4 text-right font-semibold text-emerald-400">{formatMoney(row.collectedAmount)}</td>
                                <td className="py-2.5 text-right font-semibold text-red-400">{formatMoney(row.outstandingAmount)}</td>
                              </tr>
                            )
                          })}
                          <tr className="border-t border-magenta-500/20">
                            <td className="pt-3 pr-4 text-[12px] font-bold text-magenta-300">GRAND TOTAL</td>
                            <td className="pt-3 pr-4 text-right text-[12px] font-bold text-magenta-300">{activeAttendanceTotals.boysPresent}</td>
                            <td className="pt-3 pr-4 text-right text-[12px] font-bold text-magenta-300">{activeAttendanceTotals.boysAbsent}</td>
                            <td className="pt-3 pr-4 text-right text-[12px] font-bold text-magenta-300">{activeAttendanceTotals.girlsPresent}</td>
                            <td className="pt-3 pr-4 text-right text-[12px] font-bold text-magenta-300">{activeAttendanceTotals.girlsAbsent}</td>
                            <td className="pt-3 pr-4 text-right text-[12px] font-bold text-magenta-300">{activeTotalPresent}</td>
                            <td className="pt-3 pr-4 text-right text-[12px] font-bold text-magenta-300">{activeTotalAbsent}</td>
                            <td className="pt-3 pr-4 text-right text-[12px] font-extrabold text-magenta-300">{activeGrandTotal}</td>
                            <td className="pt-3 pr-4 text-right text-[12px] font-bold text-magenta-300">{formatMoney(activeFeeTotals.expected)}</td>
                            <td className="pt-3 pr-4 text-right text-[12px] font-bold text-magenta-300">{formatMoney(activeFeeTotals.collected)}</td>
                            <td className="pt-3 text-right text-[12px] font-extrabold text-magenta-300">{formatMoney(activeFeeTotals.outstanding)}</td>
                          </tr>
                        </tbody>
                      </table>
                      <div className="mt-3 flex items-center gap-2">
                        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/[0.08]">
                          <div className="h-full rounded-full bg-gradient-to-r from-magenta-500 to-pink-400" style={{ width: `${Number(activeFeeTotals.expected) > 0 ? Math.min(Math.round((Number(activeFeeTotals.collected) / Number(activeFeeTotals.expected)) * 100), 100) : 0}%` }} />
                        </div>
                        <span className="text-[11px] font-bold text-cream-200/70 w-8 text-right">{Number(activeFeeTotals.expected) > 0 ? Math.min(Math.round((Number(activeFeeTotals.collected) / Number(activeFeeTotals.expected)) * 100), 100) : 0}%</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Outstanding Arrears panel */}
                <div className="lg:col-span-1">
                  <GlassInnerCard className="h-full">
                    <div className="flex items-center gap-2 mb-3">
                      <XCircle className="h-4 w-4 text-magenta-400/60" aria-hidden="true" />
                      <h3 className="text-[12px] font-bold text-cream-100">Outstanding Arrears</h3>
                    </div>
                    {Number(finance.totals.totalOutstanding) <= 0 ? (
                      <p className="text-[12px] text-cream-200/60 py-4 text-center">No outstanding arrears.</p>
                    ) : (
                      <>
                        <div className="space-y-2">
                          {[...finance.dailyFees, ...finance.maintenanceFees, ...finance.paFees]
                            .filter((r) => Number(r.outstandingAmount) > 0)
                            .sort((a, b) => Number(b.outstandingAmount) - Number(a.outstandingAmount))
                            .slice(0, 8)
                            .map((row) => (
                              <div
                                key={row.classId}
                                className="flex items-center justify-between rounded-xl bg-magenta-500/[0.06] border border-magenta-500/10 px-3 py-2"
                              >
                                <div className="min-w-0">
                                  <p className="text-[12px] font-semibold text-cream-100 truncate">{row.className}</p>
                                  <p className="text-[10px] text-cream-200/60">{row.pupilCount} pupils with charges</p>
                                </div>
                                <span className="text-[12px] font-bold text-red-400">{formatMoney(row.outstandingAmount)}</span>
                              </div>
                            ))}
                        </div>
                        <div className="border-t border-white/[0.06] mt-3 pt-3">
                          <div className="flex items-center justify-between">
                            <span className="text-[12px] font-bold text-cream-200/70">Total Arrears</span>
                            <span className="text-lg font-extrabold text-red-400">{formatMoney(finance.totals.totalOutstanding)}</span>
                          </div>
                        </div>
                      </>
                    )}
                  </GlassInnerCard>
                </div>
              </div>

              {/* All Classes Summary Table */}
              {(() => {
                const classMap = new Map<string, { className: string; boysPresent: number; boysAbsent: number; girlsPresent: number; girlsAbsent: number; expected: number; collected: number; outstanding: number }>()
    for (const row of [...finance.dailyFees, ...finance.maintenanceFees, ...finance.paFees]) {
                  const existing = classMap.get(row.classId) ?? {
                    className: row.className,
                    boysPresent: row.boysPresent,
                    boysAbsent: row.boysAbsent,
                    girlsPresent: row.girlsPresent,
                    girlsAbsent: row.girlsAbsent,
                    expected: 0,
                    collected: 0,
                    outstanding: 0,
                  }
                  existing.expected += Number(row.expectedAmount)
                  existing.collected += Number(row.collectedAmount)
                  existing.outstanding += Number(row.outstandingAmount)
                  classMap.set(row.classId, existing)
                }
                const allRows = [...classMap.values()].sort((a, b) => a.className.localeCompare(b.className))
                if (allRows.length === 0) return null
                const grandExpected = allRows.reduce((s, r) => s + r.expected, 0)
                const grandCollected = allRows.reduce((s, r) => s + r.collected, 0)
                const grandOutstanding = allRows.reduce((s, r) => s + r.outstanding, 0)
                const grandBoysPresent = allRows.reduce((s, r) => s + r.boysPresent, 0)
                const grandBoysAbsent = allRows.reduce((s, r) => s + r.boysAbsent, 0)
                const grandGirlsPresent = allRows.reduce((s, r) => s + r.girlsPresent, 0)
                const grandGirlsAbsent = allRows.reduce((s, r) => s + r.girlsAbsent, 0)
                const grandTotalPresent = grandBoysPresent + grandGirlsPresent
                const grandTotalAbsent = grandBoysAbsent + grandGirlsAbsent

                return (
                  <GlassInnerCard>
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <div className="inline-block w-1 h-5 rounded-full bg-magenta-500 shrink-0" aria-hidden="true" />
                        <h3 className="text-[12px] font-bold text-cream-100">All Classes — Finance Summary</h3>
                      </div>
                      <span className="text-[11px] font-semibold text-cream-200/65">
                        {finance.session?.name ?? 'No active academic year'} &middot; {finance.term?.name ?? 'No active term'}
                      </span>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-[13px]">
                        <thead>
                          <tr className="border-b border-white/[0.06]">
                            <th className="pb-2 pr-4 text-[11px] font-bold uppercase tracking-wider text-cream-200/60">Class</th>
                            <th className="pb-2 pr-4 text-[11px] font-bold uppercase tracking-wider text-cream-200/60 text-right">Boys Present</th>
                            <th className="pb-2 pr-4 text-[11px] font-bold uppercase tracking-wider text-cream-200/60 text-right">Boys Absent</th>
                            <th className="pb-2 pr-4 text-[11px] font-bold uppercase tracking-wider text-cream-200/60 text-right">Girls Present</th>
                            <th className="pb-2 pr-4 text-[11px] font-bold uppercase tracking-wider text-cream-200/60 text-right">Girls Absent</th>
                            <th className="pb-2 pr-4 text-[11px] font-bold uppercase tracking-wider text-cream-200/60 text-right">Total Present</th>
                            <th className="pb-2 pr-4 text-[11px] font-bold uppercase tracking-wider text-cream-200/60 text-right">Total Absent</th>
                            <th className="pb-2 pr-4 text-[11px] font-bold uppercase tracking-wider text-cream-200/60 text-right">Grand Total</th>
                            <th className="pb-2 pr-4 text-[11px] font-bold uppercase tracking-wider text-cream-200/60 text-right">Expected</th>
                            <th className="pb-2 pr-4 text-[11px] font-bold uppercase tracking-wider text-cream-200/60 text-right">Collected</th>
                            <th className="pb-2 text-[11px] font-bold uppercase tracking-wider text-cream-200/60 text-right">Outstanding</th>
                          </tr>
                        </thead>
                        <tbody>
                          {allRows.map((row) => {
                            const rowTotalPresent = row.boysPresent + row.girlsPresent
                            const rowTotalAbsent = row.boysAbsent + row.girlsAbsent
                            return (
                              <tr key={row.className} className="border-b border-white/[0.04]">
                                <td className="py-2.5 pr-4 font-semibold text-cream-100">{row.className}</td>
                                <td className="py-2.5 pr-4 text-right text-cream-200/60">{row.boysPresent}</td>
                                <td className="py-2.5 pr-4 text-right text-cream-200/60">{row.boysAbsent}</td>
                                <td className="py-2.5 pr-4 text-right text-cream-200/60">{row.girlsPresent}</td>
                                <td className="py-2.5 pr-4 text-right text-cream-200/60">{row.girlsAbsent}</td>
                                <td className="py-2.5 pr-4 text-right font-semibold text-emerald-400">{rowTotalPresent}</td>
                                <td className="py-2.5 pr-4 text-right font-semibold text-red-400">{rowTotalAbsent}</td>
                                <td className="py-2.5 pr-4 text-right text-cream-200/60">{rowTotalPresent + rowTotalAbsent}</td>
                                <td className="py-2.5 pr-4 text-right text-cream-200/60">{formatMoney(row.expected)}</td>
                                <td className="py-2.5 pr-4 text-right font-semibold text-emerald-400">{formatMoney(row.collected)}</td>
                                <td className="py-2.5 text-right font-semibold text-red-400">{formatMoney(row.outstanding)}</td>
                              </tr>
                            )
                          })}
                          <tr className="border-t border-magenta-500/20">
                            <td className="pt-3 pr-4 text-[12px] font-bold text-magenta-300">GRAND TOTAL</td>
                            <td className="pt-3 pr-4 text-right text-[12px] font-bold text-magenta-300">{grandBoysPresent}</td>
                            <td className="pt-3 pr-4 text-right text-[12px] font-bold text-magenta-300">{grandBoysAbsent}</td>
                            <td className="pt-3 pr-4 text-right text-[12px] font-bold text-magenta-300">{grandGirlsPresent}</td>
                            <td className="pt-3 pr-4 text-right text-[12px] font-bold text-magenta-300">{grandGirlsAbsent}</td>
                            <td className="pt-3 pr-4 text-right text-[12px] font-bold text-magenta-300">{grandTotalPresent}</td>
                            <td className="pt-3 pr-4 text-right text-[12px] font-bold text-magenta-300">{grandTotalAbsent}</td>
                            <td className="pt-3 pr-4 text-right text-[12px] font-extrabold text-magenta-300">{grandTotalPresent + grandTotalAbsent}</td>
                            <td className="pt-3 pr-4 text-right text-[12px] font-bold text-magenta-300">{formatMoney(grandExpected)}</td>
                            <td className="pt-3 pr-4 text-right text-[12px] font-bold text-magenta-300">{formatMoney(grandCollected)}</td>
                            <td className="pt-3 text-right text-[12px] font-extrabold text-magenta-300">{formatMoney(grandOutstanding)}</td>
                          </tr>
                        </tbody>
                      </table>
                      <div className="mt-3 flex items-center gap-2">
                        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/[0.08]">
                          <div className="h-full rounded-full bg-gradient-to-r from-magenta-500 to-pink-400" style={{ width: `${grandExpected > 0 ? Math.min(Math.round((grandCollected / grandExpected) * 100), 100) : 0}%` }} />
                        </div>
                        <span className="text-[11px] font-bold text-cream-200/70 w-8 text-right">{grandExpected > 0 ? Math.min(Math.round((grandCollected / grandExpected) * 100), 100) : 0}%</span>
                      </div>
                    </div>
                  </GlassInnerCard>
                )
              })()}
            </>
          )}
        </GlassCard>
      )}

      {/* ── Teachers Overview ── */}
      <GlassCard>
        <SectionHeader
          title="Teachers Overview"
          icon={GraduationCap}
          action={
            <div className="flex items-center gap-3">
              {academic && (
                <>
                  <span className="flex items-center gap-1.5 text-[11px] font-semibold text-emerald-400">
                    <CheckCircle2 className="h-3.5 w-3.5" /> {teachersPresent} Active
                  </span>
                  <span className="flex items-center gap-1.5 text-[11px] font-semibold text-red-400">
                    <XCircle className="h-3.5 w-3.5" /> {teachersInactive} Inactive
                  </span>
                </>
              )}
            </div>
          }
        />
        {!canViewTeachers ? (
          <EmptyStateCard title="Access restricted." />
        ) : sectionErrors.teachers ? (
          <EmptyStateCard title="Could not load teachers." description={sectionErrors.teachers} />
        ) : teachers === null ? (
          <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <SkeletonRow key={i} />)}</div>
        ) : teachers.length === 0 ? (
          <EmptyStateCard title="No teacher data available yet." description="Teachers will appear here once registered." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[13px]">
              <thead>
                <tr className="border-b border-white/[0.06]">
                  <th className="pb-2 pr-4 text-[11px] font-bold uppercase tracking-wider text-cream-200/60">Teacher</th>
                  <th className="pb-2 pr-4 text-[11px] font-bold uppercase tracking-wider text-cream-200/60">Class / Subject</th>
                  <th className="pb-2 pr-4 text-[11px] font-bold uppercase tracking-wider text-cream-200/60">Assignments</th>
                  <th className="pb-2 text-[11px] font-bold uppercase tracking-wider text-cream-200/60">Status</th>
                </tr>
              </thead>
              <tbody>
                {teachers.map((t) => (
                  <tr key={t.id} className="border-b border-white/[0.04]">
                    <td className="py-2.5 pr-4">
                      <div className="flex items-center gap-2.5">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-magenta-500/15 text-[11px] font-bold text-magenta-300">
                          {t.fullName.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-cream-100 truncate">{t.fullName}</p>
                          <p className="text-[10px] text-cream-200/60">{t.positionLabel}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-2.5 pr-4 text-cream-200/60">
                      {t.classTeacherClassCount > 0
                        ? `${t.classTeacherClassCount} class(es)`
                        : t.assignmentCount > 0
                          ? `${t.assignmentCount} assignment(s)`
                          : '\u2014'}
                    </td>
                    <td className="py-2.5 pr-4 text-cream-200/60">{t.assignmentCount}</td>
                    <td className="py-2.5">
                      <span
                        className={cn(
                          'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 ring-inset',
                          t.status === 'ACTIVE'
                            ? 'bg-emerald-500/10 text-emerald-300 ring-emerald-500/20'
                            : 'bg-red-500/10 text-red-300 ring-red-500/20',
                        )}
                      >
                        <span className={cn('h-1.5 w-1.5 rounded-full', t.status === 'ACTIVE' ? 'bg-emerald-400' : 'bg-red-400')} />
                        {t.status === 'ACTIVE' ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </GlassCard>

      {/* ── Academic Overview ── */}
      {canViewAcademic && (
        <GlassCard>
          <SectionHeader
            title="Academic Overview"
            icon={BookOpenCheck}
            action={
              <Link
                to="/headteacher/academic/teachers"
                className="text-[12px] font-semibold text-magenta-400 hover:text-magenta-300"
              >
                Manage academic &rarr;
              </Link>
            }
          />
          {academic === null ? (
            sectionErrors.academic ? (
              <EmptyStateCard title="Could not load academic overview." description={sectionErrors.academic} />
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {Array.from({ length: 4 }).map((_, index) => (
                  <SkeletonRow key={index} />
                ))}
              </div>
            )
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <GlassInnerCard>
                <p className="text-[11px] font-bold uppercase tracking-wider text-cream-200/60">Teachers</p>
                <p className="mt-1 text-xl font-extrabold text-cream-100">{academic.teachers.total}</p>
                <p className="text-[11px] text-cream-200/60">{academic.teachers.active} active</p>
              </GlassInnerCard>
              <GlassInnerCard>
                <p className="text-[11px] font-bold uppercase tracking-wider text-cream-200/60">Subjects</p>
                <p className="mt-1 text-xl font-extrabold text-cream-100">{academic.subjects.total}</p>
                <p className="text-[11px] text-cream-200/60">{academic.subjects.active} active</p>
              </GlassInnerCard>
              <GlassInnerCard>
                <p className="text-[11px] font-bold uppercase tracking-wider text-cream-200/60">Assignments</p>
                <p className="mt-1 text-xl font-extrabold text-cream-100">{academic.assignments.total}</p>
                <p className="text-[11px] text-cream-200/60">{academic.assignments.active} active</p>
              </GlassInnerCard>
              <GlassInnerCard>
                <p className="text-[11px] font-bold uppercase tracking-wider text-cream-200/60">SBA Records</p>
                <p className="mt-1 text-xl font-extrabold text-cream-100">{academic.sba.total}</p>
                <p className="text-[11px] text-cream-200/60">{academic.sba.recordsCurrentTerm} this term</p>
              </GlassInnerCard>
            </div>
          )}
        </GlassCard>
      )}

      {/* ── Staff Overview ── */}
      <GlassCard>
        <SectionHeader
          title="Staff Overview"
          icon={Users}
          action={
            <Link
              to="/headteacher/staff"
              className="text-[12px] font-semibold text-magenta-400 hover:text-magenta-300"
            >
              Manage staff &rarr;
            </Link>
          }
        />
        {staff === null ? (
          sectionErrors.staff ? (
            <EmptyStateCard title="Could not load staff." description={sectionErrors.staff} />
          ) : loading ? (
            <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <SkeletonRow key={i} />)}</div>
          ) : (
            <EmptyStateCard title="Staff data unavailable." />
          )
        ) : staff.length === 0 ? (
          <EmptyStateCard title="No staff members found." description="Teaching and non-teaching staff you manage will appear here." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[13px]">
              <thead>
                <tr className="border-b border-white/[0.06]">
                  <th className="pb-2 pr-4 text-[11px] font-bold uppercase tracking-wider text-cream-200/60">Staff Member</th>
                  <th className="pb-2 pr-4 text-[11px] font-bold uppercase tracking-wider text-cream-200/60">Staff ID</th>
                  <th className="pb-2 pr-4 text-[11px] font-bold uppercase tracking-wider text-cream-200/60">Role</th>
                  <th className="pb-2 text-[11px] font-bold uppercase tracking-wider text-cream-200/60">Status</th>
                </tr>
              </thead>
              <tbody>
                {staff.slice(0, 6).map((entry) => (
                  <tr key={entry.id} className="border-b border-white/[0.04]">
                    <td className="py-2.5 pr-4">
                      <div className="flex items-center gap-2.5">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-magenta-500/15 text-[11px] font-bold text-magenta-300">
                          {entry.fullName.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()}
                        </div>
                        <span className="font-semibold text-cream-100">{entry.fullName}</span>
                      </div>
                    </td>
                    <td className="py-2.5 pr-4 text-cream-200/60">{entry.staffId}</td>
                    <td className="py-2.5 pr-4 text-cream-200/60">{entry.roles.join(', ')}</td>
                    <td className="py-2.5">
                      <span
                        className={cn(
                          'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 ring-inset',
                          entry.status === 'ACTIVE'
                            ? 'bg-emerald-500/10 text-emerald-300 ring-emerald-500/20'
                            : 'bg-red-500/10 text-red-300 ring-red-500/20',
                        )}
                      >
                        <span className={cn('h-1.5 w-1.5 rounded-full', entry.status === 'ACTIVE' ? 'bg-emerald-400' : 'bg-red-400')} />
                        {entry.status === 'ACTIVE' ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </GlassCard>
    </div>
  )
}
