import { useCallback, useEffect, useState } from 'react'
import {
  BookOpen,
  CalendarDays,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  FileText,
  GraduationCap,
  ListChecks,
  Pencil,
  Search,
  Trophy,
} from 'lucide-react'
import { useAuth } from '@/auth/AuthContext'
import { api } from '@/lib/api'
import { cn } from '@/lib/cn'
import type {
  AcademicSessionView,
  AcademicTermView,
  SubjectView,
  TeacherListRow,
  WorkOutputTeacherDetail,
  WorkOutputTeacherSubjectRow,
  WorkOutputWeeklyRow,
} from '@/types/portal'

/** Single source of truth for term length. Change here to adjust everywhere. */
const WEEKS_PER_TERM = 16

// ── Reusable UI components (matches OwnerDashboardPage patterns) ──────

function GlassCard({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn('glass-card p-5', className)}>{children}</div>
}

function SectionBar() {
  return <span className="inline-block w-1 h-5 rounded-full bg-magenta-500 mr-2.5 shrink-0" aria-hidden="true" />
}

function SectionHeader({
  title,
  icon: Icon,
  children,
}: {
  title: string
  icon: typeof ListChecks
  children?: React.ReactNode
}) {
  return (
    <div className="flex items-center justify-between mb-4">
      <div className="flex items-center">
        <SectionBar />
        <Icon className="h-4 w-4 text-magenta-400/60 mr-2" aria-hidden="true" />
        <h2 className="text-sm font-bold text-cream-100">{title}</h2>
      </div>
      {children}
    </div>
  )
}

function KpiCard({
  icon: Icon,
  label,
  value,
  accent,
}: {
  icon: typeof ListChecks
  label: string
  value: string | number
  accent?: boolean
}) {
  return (
    <GlassCard>
      <div className="flex items-start gap-3">
        <span
          className={cn(
            'flex h-8 w-8 shrink-0 items-center justify-center rounded-md',
            accent ? 'bg-magenta-500/20 text-magenta-300' : 'bg-white/[0.06] text-cream-200/70',
          )}
        >
          <Icon className="h-4 w-4" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-bold uppercase tracking-wider text-cream-200/60">{label}</p>
          <p className={cn('mt-1 text-[32px] font-bold tracking-tight leading-none', accent ? 'text-magenta-300' : 'text-white')}>
            {value}
          </p>
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

// ── Filter select ────────────────────────────────────────────────────

function FilterSelect({
  label,
  value,
  onChange,
  options,
  placeholder,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  options: Array<{ value: string; label: string }>
  placeholder?: string
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[10px] font-bold uppercase tracking-wider text-cream-200/60">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-lg border border-white/[0.08] bg-white/[0.05] px-3 py-2 text-[13px] text-cream-100 outline-none focus:border-magenta-500/40 focus:ring-1 focus:ring-magenta-500/20"
      >
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  )
}

// ── Week pills ───────────────────────────────────────────────────────

function WeekPills({
  activeWeek,
  onChange,
}: {
  activeWeek: number | null
  onChange: (w: number | null) => void
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      <button
        type="button"
        onClick={() => onChange(null)}
        className={cn(
          'rounded-full px-2.5 py-1 text-[10px] font-semibold transition-colors',
          activeWeek === null
            ? 'bg-magenta-500/20 text-magenta-300 ring-1 ring-magenta-500/30'
            : 'bg-white/[0.05] text-cream-200/65 hover:bg-white/[0.08]',
        )}
      >
        All Weeks
      </button>
      {Array.from({ length: WEEKS_PER_TERM }, (_, i) => i + 1).map((w) => (
        <button
          key={w}
          type="button"
          onClick={() => onChange(w)}
          className={cn(
            'rounded-full px-2 py-1 text-[10px] font-semibold transition-colors',
            activeWeek === w
              ? 'bg-magenta-500/20 text-magenta-300 ring-1 ring-magenta-500/30'
              : 'bg-white/[0.05] text-cream-200/65 hover:bg-white/[0.08]',
          )}
        >
          W{w}
        </button>
      ))}
    </div>
  )
}

// ── Teacher-subject grid table ───────────────────────────────────────

function TeacherSubjectTable({
  rows,
  teachers,
  expandedTeachers,
  onToggle,
}: {
  rows: WorkOutputTeacherSubjectRow[]
  teachers: WorkOutputTeacherDetail[]
  expandedTeachers: Set<string>
  onToggle: (teacherId: string) => void
}) {
  if (rows.length === 0) {
    return <EmptyStateCard title="No work output recorded for the selected period." />
  }

  // Group by teacher
  const teacherMap = new Map<string, { name: string; subjects: WorkOutputTeacherSubjectRow[] }>()
  for (const row of rows) {
    const existing = teacherMap.get(row.teacherId) ?? { name: row.teacherName, subjects: [] }
    existing.subjects.push(row)
    teacherMap.set(row.teacherId, existing)
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-[13px]">
        <thead>
          <tr className="border-b border-white/[0.06]">
            <th className="pb-2 pr-4 text-[11px] font-bold uppercase tracking-wider text-cream-200/60 w-8" />
            <th className="pb-2 pr-4 text-[11px] font-bold uppercase tracking-wider text-cream-200/60">Teacher</th>
            <th className="pb-2 pr-4 text-[11px] font-bold uppercase tracking-wider text-cream-200/60">Subject</th>
            <th className="pb-2 pr-4 text-[11px] font-bold uppercase tracking-wider text-cream-200/60">Class</th>
            <th className="pb-2 pr-4 text-[11px] font-bold uppercase tracking-wider text-cream-200/60 text-right">Exercises</th>
            <th className="pb-2 pr-4 text-[11px] font-bold uppercase tracking-wider text-cream-200/60 text-right">Quizzes</th>
            <th className="pb-2 pr-4 text-[11px] font-bold uppercase tracking-wider text-cream-200/60 text-right">Homework</th>
            <th className="pb-2 text-[11px] font-bold uppercase tracking-wider text-cream-200/60 text-right">Mid-Term</th>
          </tr>
        </thead>
        <tbody>
          {[...teacherMap.entries()].map(([teacherId, teacher]) => {
            const isExpanded = expandedTeachers.has(teacherId)
            const totalExercises = teacher.subjects.reduce((s, r) => s + r.exercises, 0)
            const totalQuizzes = teacher.subjects.reduce((s, r) => s + r.quizzes, 0)
            const totalHomework = teacher.subjects.reduce((s, r) => s + r.homework, 0)
            const totalMidterm = teacher.subjects.reduce((s, r) => s + r.midtermExams, 0)

            return (
              <>
                {/* Teacher summary row */}
                <tr
                  key={`teacher-${teacherId}`}
                  className="border-b border-white/[0.04] cursor-pointer hover:bg-white/[0.03]"
                  onClick={() => onToggle(teacherId)}
                >
                  <td className="py-2.5 pr-2 text-cream-200/65">
                    {isExpanded ? (
                      <ChevronDown className="h-3.5 w-3.5" />
                    ) : (
                      <ChevronRight className="h-3.5 w-3.5" />
                    )}
                  </td>
                  <td className="py-2.5 pr-4">
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-magenta-500/15 text-[10px] font-bold text-magenta-300">
                        {teacher.name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()}
                      </div>
                      <span className="font-semibold text-cream-100">{teacher.name}</span>
                    </div>
                  </td>
                  <td className="py-2.5 pr-4 text-cream-200/65 text-[12px] italic" colSpan={2}>
                    {teacher.subjects.length} subject{teacher.subjects.length !== 1 ? 's' : ''}
                  </td>
                  <td className="py-2.5 pr-4 text-right font-bold text-white">{totalExercises}</td>
                  <td className="py-2.5 pr-4 text-right font-bold text-white">{totalQuizzes}</td>
                  <td className="py-2.5 pr-4 text-right font-bold text-white">{totalHomework}</td>
                  <td className="py-2.5 text-right font-bold text-magenta-300">{totalMidterm}</td>
                </tr>

                {/* Subject detail rows (when expanded) */}
                {isExpanded &&
                  teacher.subjects.map((sub) => (
                    <tr key={`${teacherId}-${sub.subjectId}-${sub.classId}`} className="border-b border-white/[0.03] bg-white/[0.02]">
                      <td />
                      <td className="py-2 pr-4 text-cream-200/65" />
                      <td className="py-2 pr-4 text-cream-100">
                        <span className="font-semibold">{sub.subjectName}</span>
                        <span className="ml-1.5 text-[10px] text-cream-200/60">({sub.subjectCode})</span>
                      </td>
                      <td className="py-2 pr-4 text-cream-200/70">{sub.className}</td>
                      <td className="py-2 pr-4 text-right text-cream-200/70">{sub.exercises}</td>
                      <td className="py-2 pr-4 text-right text-cream-200/70">{sub.quizzes}</td>
                      <td className="py-2 pr-4 text-right text-cream-200/70">{sub.homework}</td>
                      <td className="py-2 text-right text-magenta-300/85">{sub.midtermExams}</td>
                    </tr>
                  ))}

                {/* Expanded weekly detail per subject */}
                {isExpanded &&
                  teacher.subjects.map((sub) => {
                    const teacherDetail = teachers.find((t) => t.teacherId === teacherId)
                    const subjectDetail = teacherDetail?.subjects.find(
                      (s) => s.subjectId === sub.subjectId && s.classId === sub.classId,
                    )
                    return (
                      <tr key={`weekly-${teacherId}-${sub.subjectId}-${sub.classId}`} className="bg-white/[0.01]">
                        <td colSpan={8} className="px-4 py-2">
                          <WeeklyBreakdown
                            teacherName={teacher.name}
                            subjectName={sub.subjectName}
                            weekly={subjectDetail?.weekly ?? []}
                          />
                        </td>
                      </tr>
                    )
                  })}
              </>
            )
          })}

          {/* Grand total row */}
          <tr className="border-t border-magenta-500/20">
            <td />
            <td colSpan={3} className="pt-3 pr-4 text-[12px] font-bold text-magenta-300">School Total</td>
            <td className="pt-3 pr-4 text-right text-[12px] font-bold text-magenta-300">
              {rows.reduce((s, r) => s + r.exercises, 0)}
            </td>
            <td className="pt-3 pr-4 text-right text-[12px] font-bold text-magenta-300">
              {rows.reduce((s, r) => s + r.quizzes, 0)}
            </td>
            <td className="pt-3 pr-4 text-right text-[12px] font-bold text-magenta-300">
              {rows.reduce((s, r) => s + r.homework, 0)}
            </td>
            <td className="pt-3 text-right text-[12px] font-extrabold text-magenta-300">
              {rows.reduce((s, r) => s + r.midtermExams, 0)}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  )
}

// ── Weekly breakdown mini-table ──────────────────────────────────────

function WeeklyBreakdown({
  teacherName,
  subjectName,
  weekly,
}: {
  teacherName: string
  subjectName: string
  weekly: WorkOutputWeeklyRow[]
}) {
  const data = weekly.length > 0 ? weekly : Array.from({ length: WEEKS_PER_TERM }, (_, i) => ({
    weekNumber: i + 1,
    exercises: 0,
    quizzes: 0,
    homework: 0,
    midtermExams: 0,
  }))

  const hasWork = data.some((w) => w.exercises > 0 || w.quizzes > 0 || w.homework > 0 || w.midtermExams > 0)

  return (
    <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] overflow-hidden">
      <div className="px-3 py-2 border-b border-white/[0.06]">
        <p className="text-[11px] font-semibold text-cream-200/70">
          {teacherName} — {subjectName} — Weekly Breakdown
        </p>
      </div>
      {!hasWork ? (
        <p className="px-3 py-3 text-[11px] text-cream-200/60 italic">No work recorded for this subject.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-[11px]">
            <thead>
              <tr className="border-b border-white/[0.04]">
                <th className="px-3 py-1.5 text-left font-bold uppercase tracking-wider text-cream-200/60">Week</th>
                <th className="px-3 py-1.5 text-right font-bold uppercase tracking-wider text-cream-200/60">Exercises</th>
                <th className="px-3 py-1.5 text-right font-bold uppercase tracking-wider text-cream-200/60">Quizzes</th>
                <th className="px-3 py-1.5 text-right font-bold uppercase tracking-wider text-cream-200/60">Homework</th>
                <th className="px-3 py-1.5 text-right font-bold uppercase tracking-wider text-cream-200/60">Mid-Term</th>
              </tr>
            </thead>
            <tbody>
              {data.filter((w) => w.exercises > 0 || w.quizzes > 0 || w.homework > 0 || w.midtermExams > 0).map((w) => (
                <tr key={w.weekNumber} className="border-b border-white/[0.03]">
                  <td className="px-3 py-1.5 font-semibold text-cream-100">Week {w.weekNumber}</td>
                  <td className="px-3 py-1.5 text-right text-cream-200/60">{w.exercises}</td>
                  <td className="px-3 py-1.5 text-right text-cream-200/60">{w.quizzes}</td>
                  <td className="px-3 py-1.5 text-right text-cream-200/60">{w.homework}</td>
                  <td className="px-3 py-1.5 text-right text-magenta-300/85">{w.midtermExams}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ── Main page ────────────────────────────────────────────────────────

export function OwnerWorkOutputPage() {
  const { hasPermission } = useAuth()
  const [summary, setSummary] = useState<WorkOutputTeacherSubjectRow[] | null>(null)
  const [rawSummary, setRawSummary] = useState<WorkOutputTeacherDetail[] | null>(null)
  const [totals, setTotals] = useState<{ exercises: number; quizzes: number; homework: number; midtermExams: number; totalTeachers: number; totalSubjects: number } | null>(null)
  const [termInfo, setTermInfo] = useState<{ id: string; name: string } | null>(null)
  const [sessionInfo, setSessionInfo] = useState<{ id: string; name: string } | null>(null)

  const [sessions, setSessions] = useState<AcademicSessionView[]>([])
  const [terms, setTerms] = useState<AcademicTermView[]>([])
  const [teachers, setTeachers] = useState<TeacherListRow[]>([])
  const [subjects, setSubjects] = useState<SubjectView[]>([])

  const [selectedSession, setSelectedSession] = useState('')
  const [selectedTerm, setSelectedTerm] = useState('')
  const [selectedTeacher, setSelectedTeacher] = useState('')
  const [selectedSubject, setSelectedSubject] = useState('')
  const [selectedWeek, setSelectedWeek] = useState<number | null>(null)

  const [expandedTeachers, setExpandedTeachers] = useState<Set<string>>(new Set())
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const canView = hasPermission('owner.manage')

  // Load initial data
  useEffect(() => {
    if (!canView) return
    void (async () => {
      try {
        const [sess, teach, subj] = await Promise.all([
          api.listSessions(),
          api.listTeachers(),
          api.listSubjects(),
        ])
        setSessions(sess)
        setTeachers(teach)
        setSubjects(subj)

        // Auto-select active session
        const active = sess.find((s) => s.status === 'ACTIVE')
        if (active) {
          setSelectedSession(active.id)
          const t = await api.listSessions().then(() => api.listTerms(active.id))
          setTerms(t)
          const activeTerm = t.find((tt) => tt.status === 'ACTIVE')
          if (activeTerm) setSelectedTerm(activeTerm.id)
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load filter data.')
      }
    })()
  }, [canView])

  // Load terms when session changes
  useEffect(() => {
    if (!selectedSession) { setTerms([]); return }
    void api.listTerms(selectedSession).then(setTerms).catch(() => setTerms([]))
  }, [selectedSession])

  // Load work output when filters change
  const loadWorkOutput = useCallback(async () => {
    if (!canView) return
    setLoading(true)
    setError(null)
    try {
      const result = await api.getWorkOutput({
        sessionId: selectedSession || undefined,
        termId: selectedTerm || undefined,
        teacherId: selectedTeacher || undefined,
        subjectId: selectedSubject || undefined,
        weekNumber: selectedWeek ?? undefined,
      })
      setSummary(result.byTeacherSubject)
      setRawSummary(result.byTeacher)
      setTotals(result.totals)
      setTermInfo(result.term)
      setSessionInfo(result.session)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load work output.')
    } finally {
      setLoading(false)
    }
  }, [canView, selectedSession, selectedTerm, selectedTeacher, selectedSubject, selectedWeek])

  useEffect(() => {
    void loadWorkOutput()
  }, [loadWorkOutput])

  const toggleTeacher = useCallback((teacherId: string) => {
    setExpandedTeachers((prev) => {
      const next = new Set(prev)
      if (next.has(teacherId)) next.delete(teacherId)
      else next.add(teacherId)
      return next
    })
  }, [])

  if (!canView) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-white/[0.08] bg-white/[0.03] px-6 py-12 text-center">
        <p className="text-sm font-bold text-cream-200/70">Access restricted.</p>
        <p className="mt-1 text-[12px] text-cream-200/60">Only the school Owner can view Work Output.</p>
      </div>
    )
  }

  const teacherOptions = teachers
    .filter((t) => t.status === 'ACTIVE')
    .map((t) => ({ value: t.id, label: t.fullName }))

  const subjectOptions = subjects
    .filter((s) => s.status === 'ACTIVE')
    .map((s) => ({ value: s.id, label: `${s.name} (${s.code})` }))

  const sessionOptions = sessions.map((s) => ({ value: s.id, label: s.name }))
  const termOptions = terms.map((t) => ({ value: t.id, label: t.name }))

  return (
    <div className="space-y-6">
      {/* ── Page header ── */}
      <div>
        <div className="flex items-center">
          <SectionBar />
          <ClipboardList className="h-4 w-4 text-magenta-400/60 mr-2" aria-hidden="true" />
          <h1 className="text-[17px] font-bold text-cream-100">Work Output</h1>
        </div>
        <p className="mt-1 ml-3.5 text-[12px] text-cream-200/60">
          Monitor exercises, quizzes, homework, and mid-term exams assigned by teachers across each term.
        </p>
      </div>

      {/* ── Filters ── */}
      <GlassCard>
        <SectionHeader title="Filters" icon={Search}>
          <span className="text-[10px] text-cream-200/60">
            {termInfo?.name ?? 'No term selected'}{sessionInfo ? ` · ${sessionInfo.name}` : ''}
          </span>
        </SectionHeader>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <FilterSelect
            label="Academic Year"
            value={selectedSession}
            onChange={(v) => { setSelectedSession(v); setSelectedTerm('') }}
            options={sessionOptions}
            placeholder="All sessions"
          />
          <FilterSelect
            label="Term"
            value={selectedTerm}
            onChange={setSelectedTerm}
            options={termOptions}
            placeholder="All terms"
          />
          <FilterSelect
            label="Teacher"
            value={selectedTeacher}
            onChange={setSelectedTeacher}
            options={teacherOptions}
            placeholder="All teachers"
          />
          <FilterSelect
            label="Subject"
            value={selectedSubject}
            onChange={setSelectedSubject}
            options={subjectOptions}
            placeholder="All subjects"
          />
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-bold uppercase tracking-wider text-cream-200/60">Week</label>
            <select
              value={selectedWeek ?? ''}
              onChange={(e) => setSelectedWeek(e.target.value ? Number(e.target.value) : null)}
              className="rounded-lg border border-white/[0.08] bg-white/[0.05] px-3 py-2 text-[13px] text-cream-100 outline-none focus:border-magenta-500/40 focus:ring-1 focus:ring-magenta-500/20"
            >
              <option value="">All Weeks</option>
              {Array.from({ length: WEEKS_PER_TERM }, (_, i) => i + 1).map((w) => (
                <option key={w} value={w}>Week {w}</option>
              ))}
            </select>
          </div>
        </div>
      </GlassCard>

      {/* ── Error state ── */}
      {error && (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-red-500/20 bg-red-500/[0.06] px-6 py-8 text-center">
          <p className="text-sm font-bold text-red-300">{error}</p>
          <button
            type="button"
            onClick={() => void loadWorkOutput()}
            className="mt-3 rounded-full bg-magenta-500 px-4 py-1.5 text-[12px] font-semibold text-white hover:bg-magenta-600"
          >
            Try again
          </button>
        </div>
      )}

      {/* ── KPI Cards ── */}
      {!loading && totals && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
          <KpiCard icon={Pencil} label="Total Exercises" value={totals.exercises} accent />
          <KpiCard icon={FileText} label="Total Quizzes" value={totals.quizzes} />
          <KpiCard icon={BookOpen} label="Total Homework" value={totals.homework} />
          <KpiCard icon={Trophy} label="Mid-Term Exams" value={totals.midtermExams} accent />
          <KpiCard icon={GraduationCap} label="Teachers" value={totals.totalTeachers} />
          <KpiCard icon={ListChecks} label="Subjects" value={totals.totalSubjects} />
        </div>
      )}

      {/* ── Week pills (when viewing a specific term) ── */}
      {selectedTerm && (
        <GlassCard>
          <SectionHeader title="Week Selection" icon={CalendarDays} />
          <WeekPills activeWeek={selectedWeek} onChange={setSelectedWeek} />
        </GlassCard>
      )}

      {/* ── Teacher Work Output table ── */}
      <GlassCard>
        <SectionHeader
          title="Teacher Work Output"
          icon={GraduationCap}
        >
          {!loading && summary && (
            <span className="text-[11px] font-semibold text-cream-200/65">
              {summary.length} record{summary.length !== 1 ? 's' : ''}
            </span>
          )}
        </SectionHeader>
        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)}
          </div>
        ) : !summary ? null : (
          <TeacherSubjectTable
            rows={summary}
            teachers={rawSummary ?? []}
            expandedTeachers={expandedTeachers}
            onToggle={toggleTeacher}
          />
        )}
      </GlassCard>

      {/* ── Footer ── */}
      <p className="text-center text-[10px] text-cream-200/60 pt-2">
        PRPS Work Output Monitor &middot; Data refreshes on filter change
      </p>
    </div>
  )
}
