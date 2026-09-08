import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  BookOpenCheck,
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
import { formatMoney } from '@/lib/money'
import type {
  AcademicStatsView,
  AttendanceView,
  FinanceSummaryView,
  OwnerSummary,
  StaffStats,
  StaffView,
  TeacherListRow,
} from '@/types/portal'

function todayStr(): string {
  return new Date().toISOString().slice(0, 10)
}

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
              : 'bg-white/[0.06] text-cream-200/50',
          )}
        >
          <Icon className="h-5 w-5" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-bold uppercase tracking-wider text-cream-200/35">{label}</p>
          <p className={cn('mt-1 text-2xl font-extrabold tracking-tight', accent ? 'text-magenta-300' : 'text-white')}>
            {value}
          </p>
          {supporting && <p className="mt-1 text-[11px] text-cream-200/30">{supporting}</p>}
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
      <p className="text-sm font-semibold text-cream-200/50">{title}</p>
      {description && <p className="mt-1 text-[12px] text-cream-200/30">{description}</p>}
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
  const [stats, setStats] = useState<StaffStats | null>(null)
  const [summary, setSummary] = useState<OwnerSummary | null>(null)
  const [finance, setFinance] = useState<FinanceSummaryView | null>(null)
  const [academic, setAcademic] = useState<AcademicStatsView | null>(null)
  const [teachers, setTeachers] = useState<TeacherListRow[]>([])
  const [attendance, setAttendance] = useState<AttendanceView[]>([])
  const [error, setError] = useState<string | null>(null)

  const canViewPupils = hasPermission('pupils.view')
  const canViewFinance = hasPermission('finance.view')
  const canViewAcademic = hasPermission('academic.view')
  const canViewTeachers = hasPermission('teachers.view')
  const canViewAttendance = hasPermission('attendance.view')

  const load = useCallback(async () => {
    setError(null)
    try {
      const today = todayStr()
      const results = await Promise.allSettled([
        api.listStaff(),
        api.staffStats(),
        api.ownerSummary().catch(() => null),
        canViewFinance ? api.financeSummary() : Promise.resolve(null),
        canViewAcademic ? api.academicStats() : Promise.resolve(null),
        canViewTeachers ? api.listTeachers() : Promise.resolve([]),
        canViewAttendance ? api.listAttendance({ dateFrom: today, dateTo: today }) : Promise.resolve([]),
      ])

      const get = <T,>(i: number, fallback: T): T =>
        results[i].status === 'fulfilled' ? (results[i] as PromiseFulfilledResult<T>).value : fallback

      setStaff(get<StaffView[] | null>(0, null))
      setStats(get<StaffStats | null>(1, null))
      setSummary(get<OwnerSummary | null>(2, null))
      setFinance(get<FinanceSummaryView | null>(3, null))
      setAcademic(get<AcademicStatsView | null>(4, null))
      setTeachers(get<TeacherListRow[]>(5, []))
      setAttendance(get<AttendanceView[]>(6, []))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load the dashboard.')
    }
  }, [canViewPupils, canViewFinance, canViewAcademic, canViewTeachers, canViewAttendance])

  useEffect(() => {
    void load()
  }, [load])

  const boys = summary ? summary.pupilsByClass.reduce((s, e) => s + e.boys, 0) : 0
  const girls = summary ? summary.pupilsByClass.reduce((s, e) => s + e.girls, 0) : 0
  const teachersPresent = teachers.filter((t) => t.status === 'ACTIVE').length
  const teachersInactive = teachers.filter((t) => t.status === 'INACTIVE').length

  const attendanceByClass = useMemo(() => {
    if (!summary) return []
    return summary.pupilsByClass.map((cls) => {
      const classAttendance = attendance.filter((a) => a.classId === cls.classId)
      const present = classAttendance.filter((a) => a.status === 'PRESENT' || a.status === 'CHECKED_IN').length
      const absent = classAttendance.filter((a) => a.status === 'ABSENT').length
      return {
        className: cls.className,
        totalPupils: cls.total,
        boys: cls.boys,
        girls: cls.girls,
        present,
        absent,
        attendancePct: cls.total > 0 ? Math.round((present / cls.total) * 100) : 0,
      }
    })
  }, [summary, attendance])

  const totalPresent = attendanceByClass.reduce((s, c) => s + c.present, 0)
  const totalAbsent = attendanceByClass.reduce((s, c) => s + c.absent, 0)
  const totalPupilsInClasses = attendanceByClass.reduce((s, c) => s + c.totalPupils, 0)
  const overallAttendancePct = totalPupilsInClasses > 0 ? Math.round((totalPresent / totalPupilsInClasses) * 100) : 0

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
          value={summary ? summary.totals.pupils : stats ? 0 : '—'}
          accent
          supporting={summary ? `${boys} boys · ${girls} girls` : 'Loading...'}
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
          value={summary ? summary.totals.activePupils : '—'}
          supporting={summary ? `${summary.totals.inactivePupils} inactive` : 'Loading...'}
        />
        <KpiCard
          icon={ClipboardList}
          label="Work Output"
          value={academic ? 'View' : '—'}
          accent
          supporting={canViewTeachers ? 'Teacher submissions pending review' : 'Loading...'}
        />
      </div>

      {/* ── Attendance by Class ── */}
      <GlassCard>
        <SectionHeader
          title="Attendance by Class"
          icon={Clock}
          action={
            <span className="text-[11px] font-semibold text-cream-200/40">
              {new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' })}
            </span>
          }
        />
        {!summary ? (
          <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <SkeletonRow key={i} />)}</div>
        ) : attendanceByClass.length === 0 ? (
          <EmptyStateCard title="No attendance data available for today." description="Attendance records will appear here once checked in." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[13px]">
              <thead>
                <tr className="border-b border-white/[0.06]">
                  <th className="pb-2 pr-3 text-[11px] font-bold uppercase tracking-wider text-cream-200/35">Class</th>
                  <th className="pb-2 pr-3 text-[11px] font-bold uppercase tracking-wider text-cream-200/35 text-right">Boys Present</th>
                  <th className="pb-2 pr-3 text-[11px] font-bold uppercase tracking-wider text-cream-200/35 text-right">Boys Absent</th>
                  <th className="pb-2 pr-3 text-[11px] font-bold uppercase tracking-wider text-cream-200/35 text-right">Girls Present</th>
                  <th className="pb-2 pr-3 text-[11px] font-bold uppercase tracking-wider text-cream-200/35 text-right">Girls Absent</th>
                  <th className="pb-2 pr-3 text-[11px] font-bold uppercase tracking-wider text-cream-200/35 text-right">Total Present</th>
                  <th className="pb-2 pr-3 text-[11px] font-bold uppercase tracking-wider text-cream-200/35 text-right">Total Absent</th>
                  <th className="pb-2 text-[11px] font-bold uppercase tracking-wider text-cream-200/35 text-right">Attendance %</th>
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
              <Link
                to="/headteacher/finance"
                className="text-[12px] font-semibold text-magenta-400 hover:text-magenta-300"
              >
                View details &rarr;
              </Link>
            }
          />
          {!finance ? (
            <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <SkeletonRow key={i} />)}</div>
          ) : (
            <>
              <div className="grid gap-3 sm:grid-cols-3 mb-4">
                <GlassInnerCard>
                  <p className="text-[11px] font-bold uppercase tracking-wider text-cream-200/35">Expected Fees</p>
                  <p className="mt-1 text-xl font-extrabold text-cream-100">{formatMoney(finance.expectedFees)}</p>
                </GlassInnerCard>
                <GlassInnerCard>
                  <p className="text-[11px] font-bold uppercase tracking-wider text-cream-200/35">Collected</p>
                  <p className="mt-1 text-xl font-extrabold text-emerald-400">{formatMoney(finance.collected)}</p>
                </GlassInnerCard>
                <GlassInnerCard>
                  <p className="text-[11px] font-bold uppercase tracking-wider text-cream-200/35">Outstanding</p>
                  <p className="mt-1 text-xl font-extrabold text-red-400">{formatMoney(finance.outstanding)}</p>
                </GlassInnerCard>
              </div>
              <p className="text-[11px] text-cream-200/30">
                {finance.pupilsWithOutstanding} pupil(s) carry an outstanding balance.
              </p>
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
        ) : teachers.length === 0 ? (
          <EmptyStateCard title="No teacher data available yet." description="Teachers will appear here once registered." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[13px]">
              <thead>
                <tr className="border-b border-white/[0.06]">
                  <th className="pb-2 pr-4 text-[11px] font-bold uppercase tracking-wider text-cream-200/35">Teacher</th>
                  <th className="pb-2 pr-4 text-[11px] font-bold uppercase tracking-wider text-cream-200/35">Class / Subject</th>
                  <th className="pb-2 pr-4 text-[11px] font-bold uppercase tracking-wider text-cream-200/35">Assignments</th>
                  <th className="pb-2 text-[11px] font-bold uppercase tracking-wider text-cream-200/35">Status</th>
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
                          <p className="text-[10px] text-cream-200/30">{t.positionLabel}</p>
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
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {Array.from({ length: 4 }).map((_, index) => (
                <SkeletonRow key={index} />
              ))}
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <GlassInnerCard>
                <p className="text-[11px] font-bold uppercase tracking-wider text-cream-200/35">Teachers</p>
                <p className="mt-1 text-xl font-extrabold text-cream-100">{academic.teachers.total}</p>
                <p className="text-[11px] text-cream-200/30">{academic.teachers.active} active</p>
              </GlassInnerCard>
              <GlassInnerCard>
                <p className="text-[11px] font-bold uppercase tracking-wider text-cream-200/35">Subjects</p>
                <p className="mt-1 text-xl font-extrabold text-cream-100">{academic.subjects.total}</p>
                <p className="text-[11px] text-cream-200/30">{academic.subjects.active} active</p>
              </GlassInnerCard>
              <GlassInnerCard>
                <p className="text-[11px] font-bold uppercase tracking-wider text-cream-200/35">Assignments</p>
                <p className="mt-1 text-xl font-extrabold text-cream-100">{academic.assignments.total}</p>
                <p className="text-[11px] text-cream-200/30">{academic.assignments.active} active</p>
              </GlassInnerCard>
              <GlassInnerCard>
                <p className="text-[11px] font-bold uppercase tracking-wider text-cream-200/35">SBA Records</p>
                <p className="mt-1 text-xl font-extrabold text-cream-100">{academic.sba.total}</p>
                <p className="text-[11px] text-cream-200/30">{academic.sba.recordsCurrentTerm} this term</p>
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
          <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <SkeletonRow key={i} />)}</div>
        ) : staff.length === 0 ? (
          <EmptyStateCard title="No staff members found." description="Teaching and non-teaching staff you manage will appear here." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[13px]">
              <thead>
                <tr className="border-b border-white/[0.06]">
                  <th className="pb-2 pr-4 text-[11px] font-bold uppercase tracking-wider text-cream-200/35">Staff Member</th>
                  <th className="pb-2 pr-4 text-[11px] font-bold uppercase tracking-wider text-cream-200/35">Staff ID</th>
                  <th className="pb-2 pr-4 text-[11px] font-bold uppercase tracking-wider text-cream-200/35">Role</th>
                  <th className="pb-2 text-[11px] font-bold uppercase tracking-wider text-cream-200/35">Status</th>
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
