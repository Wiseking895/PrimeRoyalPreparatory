import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  CheckCircle2,
  ClipboardList,
  Clock,
  GraduationCap,
  ListChecks,
  Search,
  Trophy,
  Users,
  XCircle,
} from 'lucide-react'
import { useAuth } from '@/auth/AuthContext'
import { api } from '@/lib/api'
import { cn } from '@/lib/cn'
import type {
  AcademicSessionView,
  AcademicTermView,
  SubjectView,
  TeacherListRow,
  WorkOutputDetailView,
  WorkOutputReviewStatus,
} from '@/types/portal'

const WEEKS_PER_TERM = 16

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
            accent ? 'bg-magenta-500/20 text-magenta-300' : 'bg-white/[0.06] text-cream-200/50',
          )}
        >
          <Icon className="h-4 w-4" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-bold uppercase tracking-wider text-cream-200/35">{label}</p>
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
      <p className="text-sm font-semibold text-cream-200/50">{title}</p>
      {description && <p className="mt-1 text-[12px] text-cream-200/30">{description}</p>}
    </div>
  )
}

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
      <label className="text-[10px] font-bold uppercase tracking-wider text-cream-200/35">{label}</label>
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

function StatusBadge({ status }: { status: WorkOutputReviewStatus }) {
  const config = {
    PENDING: { label: 'Pending Review', className: 'bg-amber-500/10 text-amber-300 ring-amber-500/20', dot: 'bg-amber-400' },
    REVIEWED: { label: 'Reviewed', className: 'bg-blue-500/10 text-blue-300 ring-blue-500/20', dot: 'bg-blue-400' },
    CONFIRMED: { label: 'Confirmed', className: 'bg-emerald-500/10 text-emerald-300 ring-emerald-500/20', dot: 'bg-emerald-400' },
  }
  const c = config[status] ?? config.PENDING
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 ring-inset', c.className)}>
      <span className={cn('h-1.5 w-1.5 rounded-full', c.dot)} />
      {c.label}
    </span>
  )
}

function ClassificationBadge({ classification }: { classification: string | null }) {
  if (!classification) return <span className="text-[11px] text-cream-200/30">&mdash;</span>
  const config: Record<string, { label: string; className: string }> = {
    EXCELLENT: { label: 'Excellent', className: 'bg-emerald-500/10 text-emerald-300 ring-emerald-500/20' },
    VERY_GOOD: { label: 'Very Good', className: 'bg-blue-500/10 text-blue-300 ring-blue-500/20' },
    GOOD: { label: 'Good', className: 'bg-amber-500/10 text-amber-300 ring-amber-500/20' },
    WEAK: { label: 'Weak', className: 'bg-red-500/10 text-red-300 ring-red-500/20' },
  }
  const c = config[classification] ?? { label: classification, className: 'bg-white/10 text-cream-200/50 ring-white/20' }
  return (
    <span className={cn('inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 ring-inset', c.className)}>
      {c.label}
    </span>
  )
}

function GradeModal({
  record,
  onClose,
  onGraded,
}: {
  record: WorkOutputDetailView
  onClose: () => void
  onGraded: (updated: WorkOutputDetailView) => void
}) {
  const [score, setScore] = useState<string>(record.score?.toString() ?? '')
  const [feedback, setFeedback] = useState(record.feedback ?? '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const scoreNum = parseFloat(score)
  const isValidScore = !isNaN(scoreNum) && scoreNum >= 0 && scoreNum <= 10

  const classifyScore = (s: number): string => {
    if (s >= 8.0) return 'EXCELLENT'
    if (s >= 6.0) return 'VERY_GOOD'
    if (s >= 5.0) return 'GOOD'
    return 'WEAK'
  }

  const handleGrade = async () => {
    if (!isValidScore) return
    setLoading(true)
    setError(null)
    try {
      const result = await api.gradeWorkOutput(record.id, { score: scoreNum, feedback: feedback.trim() || undefined })
      onGraded(result)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to grade.')
    } finally {
      setLoading(false)
    }
  }

  const handleReview = async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await api.reviewWorkOutput(record.id)
      onGraded(result)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to review.' as string)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg rounded-2xl border border-white/[0.08] bg-[#0b1430] shadow-2xl">
        <div className="flex items-center justify-between border-b border-white/[0.06] px-6 py-4">
          <h3 className="text-[15px] font-bold text-cream-100">Review Work Output</h3>
          <button type="button" onClick={onClose} className="text-cream-200/40 hover:text-cream-100">
            <XCircle className="h-5 w-5" />
          </button>
        </div>
        <div className="px-6 py-4 space-y-4">
          <div className="grid grid-cols-2 gap-3 text-[13px]">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-cream-200/35">Teacher</p>
              <p className="mt-0.5 font-semibold text-cream-100">{record.teacherName}</p>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-cream-200/35">Subject</p>
              <p className="mt-0.5 font-semibold text-cream-100">{record.subjectName} ({record.subjectCode})</p>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-cream-200/35">Class</p>
              <p className="mt-0.5 font-semibold text-cream-100">{record.className}</p>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-cream-200/35">Week</p>
              <p className="mt-0.5 font-semibold text-cream-100">Week {record.weekNumber}</p>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-cream-200/35">Work Type</p>
              <p className="mt-0.5 font-semibold text-cream-100">{record.workType.replace('_', ' ')}</p>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-cream-200/35">Status</p>
              <p className="mt-0.5"><StatusBadge status={record.reviewStatus} /></p>
            </div>
          </div>

          {record.title && (
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-cream-200/35">Title</p>
              <p className="mt-0.5 text-[13px] text-cream-100">{record.title}</p>
            </div>
          )}

          <div className="border-t border-white/[0.06] pt-4">
            <p className="text-[10px] font-bold uppercase tracking-wider text-cream-200/35 mb-2">Score (0.0 – 10.0)</p>
            <input
              type="number"
              step="0.1"
              min="0"
              max="10"
              value={score}
              onChange={(e) => setScore(e.target.value)}
              placeholder="Enter score"
              className="w-full rounded-lg border border-white/[0.08] bg-white/[0.05] px-3 py-2 text-[13px] text-cream-100 outline-none focus:border-magenta-500/40 focus:ring-1 focus:ring-magenta-500/20"
            />
            {isValidScore && (
              <p className="mt-1 text-[11px] text-cream-200/40">
                Classification: <span className="font-bold text-cream-100">{classifyScore(scoreNum)}</span>
              </p>
            )}
          </div>

          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-cream-200/35 mb-2">Feedback (optional)</p>
            <textarea
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              rows={3}
              placeholder="Add feedback for the teacher..."
              className="w-full rounded-lg border border-white/[0.08] bg-white/[0.05] px-3 py-2 text-[13px] text-cream-100 outline-none focus:border-magenta-500/40 focus:ring-1 focus:ring-magenta-500/20 resize-none"
            />
          </div>

          {error && <p className="text-[12px] text-red-400">{error}</p>}
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-white/[0.06] px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-full px-4 py-2 text-[13px] font-semibold text-cream-200/50 hover:text-cream-100"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void handleReview()}
            disabled={loading || record.reviewStatus !== 'PENDING'}
            className="rounded-full bg-white/10 px-4 py-2 text-[13px] font-semibold text-cream-100 hover:bg-white/15 disabled:opacity-40"
          >
            Mark Reviewed
          </button>
          <button
            type="button"
            onClick={() => void handleGrade()}
            disabled={loading || !isValidScore}
            className="rounded-full bg-magenta-500 px-5 py-2 text-[13px] font-semibold text-white hover:bg-magenta-600 disabled:opacity-40"
          >
            {loading ? 'Saving...' : 'Grade & Confirm'}
          </button>
        </div>
      </div>
    </div>
  )
}

export function HeadteacherWorkOutputPage() {
  const { hasPermission } = useAuth()
  const [records, setRecords] = useState<WorkOutputDetailView[] | null>(null)
  const [sessions, setSessions] = useState<AcademicSessionView[]>([])
  const [terms, setTerms] = useState<AcademicTermView[]>([])
  const [teachers, setTeachers] = useState<TeacherListRow[]>([])
  const [subjects, setSubjects] = useState<SubjectView[]>([])

  const [selectedSession, setSelectedSession] = useState('')
  const [selectedTerm, setSelectedTerm] = useState('')
  const [selectedTeacher, setSelectedTeacher] = useState('')
  const [selectedSubject, setSelectedSubject] = useState('')
  const [selectedWeek, setSelectedWeek] = useState<number | null>(null)
  const [selectedStatus, setSelectedStatus] = useState('')

  const [selectedRecord, setSelectedRecord] = useState<WorkOutputDetailView | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const canView = hasPermission('teachers.view')
  const canGrade = hasPermission('teachers.manage')

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

        const active = sess.find((s) => s.status === 'ACTIVE')
        if (active) {
          setSelectedSession(active.id)
          const t = await api.listTerms(active.id)
          setTerms(t)
          const activeTerm = t.find((tt) => tt.status === 'ACTIVE')
          if (activeTerm) setSelectedTerm(activeTerm.id)
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load filter data.')
      }
    })()
  }, [canView])

  useEffect(() => {
    if (!selectedSession) { setTerms([]); return }
    void api.listTerms(selectedSession).then(setTerms).catch(() => setTerms([]))
  }, [selectedSession])

  const loadRecords = useCallback(async () => {
    if (!canView) return
    setLoading(true)
    setError(null)
    try {
      const result = await api.listWorkOutputForReview({
        sessionId: selectedSession || undefined,
        termId: selectedTerm || undefined,
        teacherId: selectedTeacher || undefined,
        subjectId: selectedSubject || undefined,
        weekNumber: selectedWeek ?? undefined,
        reviewStatus: (selectedStatus as WorkOutputReviewStatus) || undefined,
      })
      setRecords(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load work output.')
    } finally {
      setLoading(false)
    }
  }, [canView, selectedSession, selectedTerm, selectedTeacher, selectedSubject, selectedWeek, selectedStatus])

  useEffect(() => {
    void loadRecords()
  }, [loadRecords])

  const summary = useMemo(() => {
    if (!records) return null
    const total = records.length
    const pending = records.filter((r) => r.reviewStatus === 'PENDING').length
    const reviewed = records.filter((r) => r.reviewStatus === 'REVIEWED').length
    const confirmed = records.filter((r) => r.reviewStatus === 'CONFIRMED').length
    const scores = records.filter((r) => r.score !== null).map((r) => r.score!)
    const avgScore = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : null
    const teachers = new Set(records.map((r) => r.teacherId)).size
    return { total, pending, reviewed, confirmed, averageScore: avgScore, totalTeachers: teachers }
  }, [records])

  const handleGraded = (updated: WorkOutputDetailView) => {
    setRecords((prev) => prev ? prev.map((r) => r.id === updated.id ? updated : r) : prev)
  }

  if (!canView) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-white/[0.08] bg-white/[0.03] px-6 py-12 text-center">
        <p className="text-sm font-bold text-cream-200/50">Access restricted.</p>
        <p className="mt-1 text-[12px] text-cream-200/30">Only the Headteacher can view Work Output.</p>
      </div>
    )
  }

  const teacherOptions = teachers.filter((t) => t.status === 'ACTIVE').map((t) => ({ value: t.id, label: t.fullName }))
  const subjectOptions = subjects.filter((s) => s.status === 'ACTIVE').map((s) => ({ value: s.id, label: `${s.name} (${s.code})` }))
  const sessionOptions = sessions.map((s) => ({ value: s.id, label: s.name }))
  const termOptions = terms.map((t) => ({ value: t.id, label: t.name }))
  const statusOptions = [
    { value: 'PENDING', label: 'Pending Review' },
    { value: 'REVIEWED', label: 'Reviewed' },
    { value: 'CONFIRMED', label: 'Confirmed' },
  ]

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <div className="flex items-center">
          <SectionBar />
          <ClipboardList className="h-4 w-4 text-magenta-400/60 mr-2" aria-hidden="true" />
          <h1 className="text-[17px] font-bold text-cream-100">Work Output Review</h1>
        </div>
        <p className="mt-1 ml-3.5 text-[12px] text-cream-200/30">
          Review, confirm, and grade teacher work output submissions across each term.
        </p>
      </div>

      {/* Filters */}
      <GlassCard>
        <SectionHeader title="Filters" icon={Search}>
          <span className="text-[10px] text-cream-200/30">
            {terms.find((t) => t.id === selectedTerm)?.name ?? 'No term selected'}
          </span>
        </SectionHeader>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
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
          <FilterSelect
            label="Week"
            value={selectedWeek?.toString() ?? ''}
            onChange={(v) => setSelectedWeek(v ? Number(v) : null)}
            options={Array.from({ length: WEEKS_PER_TERM }, (_, i) => ({ value: String(i + 1), label: `Week ${i + 1}` }))}
            placeholder="All weeks"
          />
          <FilterSelect
            label="Status"
            value={selectedStatus}
            onChange={setSelectedStatus}
            options={statusOptions}
            placeholder="All statuses"
          />
        </div>
      </GlassCard>

      {/* Error state */}
      {error && (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-red-500/20 bg-red-500/[0.06] px-6 py-8 text-center">
          <p className="text-sm font-bold text-red-300">{error}</p>
          <button
            type="button"
            onClick={() => void loadRecords()}
            className="mt-3 rounded-full bg-magenta-500 px-4 py-1.5 text-[12px] font-semibold text-white hover:bg-magenta-600"
          >
            Try again
          </button>
        </div>
      )}

      {/* KPI Cards */}
      {!loading && summary && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
          <KpiCard icon={ClipboardList} label="Total Submissions" value={summary.total} accent />
          <KpiCard icon={Clock} label="Pending Review" value={summary.pending} />
          <KpiCard icon={CheckCircle2} label="Reviewed" value={summary.reviewed} />
          <KpiCard icon={Trophy} label="Confirmed" value={summary.confirmed} accent />
          <KpiCard icon={GraduationCap} label="Avg Score" value={summary.averageScore !== null ? summary.averageScore.toFixed(1) : '\u2014'} />
          <KpiCard icon={Users} label="Teachers" value={summary.totalTeachers} />
        </div>
      )}

      {/* Records table */}
      <GlassCard>
        <SectionHeader title="Work Output Submissions" icon={GraduationCap}>
          {!loading && records && (
            <span className="text-[11px] font-semibold text-cream-200/40">
              {records.length} record{records.length !== 1 ? 's' : ''}
            </span>
          )}
        </SectionHeader>
        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)}
          </div>
        ) : !records || records.length === 0 ? (
          <EmptyStateCard title="No work output submissions found." description="Teacher submissions will appear here once recorded." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[13px]">
              <thead>
                <tr className="border-b border-white/[0.06]">
                  <th className="pb-2 pr-4 text-[11px] font-bold uppercase tracking-wider text-cream-200/35">Teacher</th>
                  <th className="pb-2 pr-4 text-[11px] font-bold uppercase tracking-wider text-cream-200/35">Subject</th>
                  <th className="pb-2 pr-4 text-[11px] font-bold uppercase tracking-wider text-cream-200/35">Class</th>
                  <th className="pb-2 pr-4 text-[11px] font-bold uppercase tracking-wider text-cream-200/35">Week</th>
                  <th className="pb-2 pr-4 text-[11px] font-bold uppercase tracking-wider text-cream-200/35">Type</th>
                  <th className="pb-2 pr-4 text-[11px] font-bold uppercase tracking-wider text-cream-200/35">Status</th>
                  <th className="pb-2 pr-4 text-[11px] font-bold uppercase tracking-wider text-cream-200/35">Score</th>
                  <th className="pb-2 pr-4 text-[11px] font-bold uppercase tracking-wider text-cream-200/35">Grade</th>
                  {canGrade && <th className="pb-2 text-[11px] font-bold uppercase tracking-wider text-cream-200/35">Action</th>}
                </tr>
              </thead>
              <tbody>
                {records.map((r) => (
                  <tr key={r.id} className="border-b border-white/[0.04] hover:bg-white/[0.02]">
                    <td className="py-2.5 pr-4">
                      <div className="flex items-center gap-2.5">
                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-magenta-500/15 text-[10px] font-bold text-magenta-300">
                          {r.teacherName.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()}
                        </div>
                        <span className="font-semibold text-cream-100">{r.teacherName}</span>
                      </div>
                    </td>
                    <td className="py-2.5 pr-4 text-cream-200/60">
                      {r.subjectName} <span className="text-[10px] text-cream-200/30">({r.subjectCode})</span>
                    </td>
                    <td className="py-2.5 pr-4 text-cream-200/60">{r.className}</td>
                    <td className="py-2.5 pr-4 text-cream-200/60">W{r.weekNumber}</td>
                    <td className="py-2.5 pr-4 text-cream-200/60">{r.workType.replace('_', ' ')}</td>
                    <td className="py-2.5 pr-4"><StatusBadge status={r.reviewStatus} /></td>
                    <td className="py-2.5 pr-4 font-bold text-cream-100">
                      {r.score !== null ? r.score.toFixed(1) : '\u2014'}
                    </td>
                    <td className="py-2.5 pr-4"><ClassificationBadge classification={r.classification} /></td>
                    {canGrade && (
                      <td className="py-2.5">
                        <button
                          type="button"
                          onClick={() => setSelectedRecord(r)}
                          className="rounded-full bg-magenta-500/15 px-3 py-1 text-[11px] font-semibold text-magenta-300 hover:bg-magenta-500/25"
                        >
                          Review
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </GlassCard>

      {/* Grade modal */}
      {selectedRecord && (
        <GradeModal
          record={selectedRecord}
          onClose={() => setSelectedRecord(null)}
          onGraded={handleGraded}
        />
      )}

      <p className="text-center text-[10px] text-cream-200/20 pt-2">
        PRPS Work Output Review &middot; Data refreshes on filter change
      </p>
    </div>
  )
}
