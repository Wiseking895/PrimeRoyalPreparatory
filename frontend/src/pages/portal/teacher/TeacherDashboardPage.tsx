import { useCallback, useEffect, useState } from 'react'
import {
  ArrowRight,
  BookOpenCheck,
  ClipboardList,
  GraduationCap,
  LayoutDashboard,
  ListChecks,
  Users,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/auth/AuthContext'
import { PageHeader } from '@/components/dashboard/PageHeader'
import { StatCard } from '@/components/dashboard/StatCard'
import { Card } from '@/components/ui/Card'
import { Avatar } from '@/components/dashboard/Avatar'
import { CardSkeleton } from '@/components/dashboard/Loaders'
import { ErrorState, EmptyState } from '@/components/dashboard/States'
import { api } from '@/lib/api'
import { formatDate } from '@/lib/date'
import type { AcademicStatsView, TeacherPortalView } from '@/types/portal'

function greeting(): string {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}

export function TeacherDashboardPage() {
  const { user, hasPermission } = useAuth()
  const [portal, setPortal] = useState<TeacherPortalView | null>(null)
  const [stats, setStats] = useState<AcademicStatsView | null>(null)
  const [error, setError] = useState<string | null>(null)

  const canViewAcademicStats = hasPermission('academic.view')

  const load = useCallback(async () => {
    setError(null)
    try {
      const [portalData, statsData] = await Promise.all([
        api.academicMe(),
        canViewAcademicStats ? api.academicStats() : Promise.resolve(null),
      ])
      setPortal(portalData)
      setStats(statsData)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load your dashboard.')
    }
  }, [canViewAcademicStats])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Teacher Dashboard"
        title={`${greeting()}, ${user?.fullName.split(' ')[0] ?? 'Teacher'}`}
        description={portal ? `${portal.teacher.positionLabel} · Staff ID ${portal.teacher.staffId}.` : 'Your teaching overview.'}
      />

      {error ? (
        <ErrorState message={error} onRetry={() => void load()} />
      ) : portal === null ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <CardSkeleton key={index} />
          ))}
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              label="Classes I Teach"
              value={portal.teachingAssignments.length}
              hint="Active subject assignments"
              icon={<GraduationCap className="h-5 w-5" aria-hidden="true" />}
              tone="royal"
            />
            <StatCard
              label="Classes I Manage"
              value={portal.classesAsClassTeacher.length}
              hint="Class teacher responsibilities"
              icon={<Users className="h-5 w-5" aria-hidden="true" />}
              tone="magenta"
            />
            <StatCard
              label="SBA Scores This Term"
              value={portal.sba.recordsCurrentTerm}
              hint="Records entered this term"
              icon={<ClipboardList className="h-5 w-5" aria-hidden="true" />}
              tone="green"
            />
            <StatCard
              label="SBA Scores Entered"
              value={portal.sba.totalEntered}
              hint="All-time assessment records"
              icon={<ListChecks className="h-5 w-5" aria-hidden="true" />}
              tone="gold"
            />
          </div>

          {canViewAcademicStats && stats ? (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <StatCard
                label="Teaching Staff"
                value={stats.teachers.total}
                hint={`${stats.teachers.active} active`}
                icon={<Users className="h-5 w-5" aria-hidden="true" />}
                tone="royal"
              />
              <StatCard
                label="Subjects"
                value={stats.subjects.total}
                hint={`${stats.subjects.active} active`}
                icon={<BookOpenCheck className="h-5 w-5" aria-hidden="true" />}
                tone="magenta"
              />
              <StatCard
                label="Assignments"
                value={stats.assignments.total}
                hint={`${stats.assignments.active} active`}
                icon={<LayoutDashboard className="h-5 w-5" aria-hidden="true" />}
                tone="green"
              />
              <StatCard
                label="SBA Records"
                value={stats.sba.total}
                hint={`${stats.sba.recordsCurrentTerm} this term`}
                icon={<ClipboardList className="h-5 w-5" aria-hidden="true" />}
                tone="gold"
              />
            </div>
          ) : null}

          <div className="grid gap-6 lg:grid-cols-2">
            <Card className="p-6">
              <h2 className="text-sm font-bold uppercase tracking-wider text-ink-500">My Teaching Assignments</h2>
              {portal.teachingAssignments.length === 0 ? (
                <div className="mt-4">
                  <EmptyState
                    title="No teaching assignments yet."
                    description="Once the school assigns you subjects and classes, they will appear here alongside your class-teacher duties."
                  />
                </div>
              ) : (
                <ul className="mt-4 space-y-3">
                  {portal.teachingAssignments.map((assignment) => (
                    <li key={assignment.id} className="flex items-center gap-3">
                      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-royal-600/10 text-royal-600">
                        <BookOpenCheck className="h-5 w-5" aria-hidden="true" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-bold text-ink-900">
                          {assignment.subjectName} — {assignment.className}
                        </p>
                        <p className="truncate text-xs text-ink-500">
                          {assignment.pupilCount} pupils · {assignment.sbaEnteredCount} scores entered
                        </p>
                      </div>
                      <Link
                        to="/teacher/sba/entry"
                        className="inline-flex items-center gap-1 text-xs font-semibold text-magenta-600 hover:text-magenta-700"
                      >
                        Enter scores <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            <Card className="p-6">
              <h2 className="text-sm font-bold uppercase tracking-wider text-ink-500">Recent SBA Entries</h2>
              {portal.recentSba.length === 0 ? (
                <div className="mt-4">
                  <EmptyState
                    title="No assessment scores yet."
                    description="Scores you enter for your classes will appear here so you can keep an eye on progress."
                  />
                </div>
              ) : (
                <ul className="mt-4 space-y-3">
                  {portal.recentSba.map((entry) => (
                    <li key={entry.id} className="flex items-start gap-3">
                      <Avatar name={entry.pupilName} size="sm" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-bold text-ink-900">{entry.pupilName}</p>
                        <p className="truncate text-xs text-ink-500">
                          {entry.subjectName} · {entry.className} · {entry.termName}
                        </p>
                      </div>
                      <p className="shrink-0 text-sm font-bold text-ink-900">
                        {entry.score}
                        <span className="font-medium text-ink-500">/{entry.maxScore}</span>
                      </p>
                      <p className="hidden shrink-0 text-xs text-ink-500 sm:block">{formatDate(entry.updatedAt)}</p>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>

          <Card className="p-6">
            <h2 className="text-sm font-bold uppercase tracking-wider text-ink-500">Quick Actions</h2>
            <ul className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {[
                { label: 'View My Classes', to: '/teacher/classes', icon: Users },
                { label: 'Enter SBA Scores', to: '/teacher/sba/entry', icon: ListChecks },
                { label: 'Browse SBA Records', to: '/teacher/sba', icon: ClipboardList },
                { label: 'My Profile', to: '/teacher/profile', icon: GraduationCap },
              ].map(({ label, to, icon: Icon }) => (
                <li key={label}>
                  <Link
                    to={to}
                    className="group flex items-center gap-3 rounded-xl border border-cream-200 px-4 py-3 text-sm font-semibold text-ink-700 transition-colors hover:border-magenta-300 hover:bg-magenta-50"
                  >
                    <Icon className="h-4.5 w-4.5 text-royal-600" aria-hidden="true" />
                    <span className="flex-1">{label}</span>
                    <ArrowRight
                      className="h-4 w-4 text-ink-500 transition-transform group-hover:translate-x-0.5"
                      aria-hidden="true"
                    />
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
        </>
      )}
    </div>
  )
}