import { useCallback, useEffect, useState } from 'react'
import { ArrowRight, BookOpen, BookOpenCheck, Building2, ShieldCheck, UserRound, Users } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/auth/AuthContext'
import { PageHeader } from '@/components/dashboard/PageHeader'
import { StatCard } from '@/components/dashboard/StatCard'
import { Card } from '@/components/ui/Card'
import { Avatar } from '@/components/dashboard/Avatar'
import { StatusBadge } from '@/components/dashboard/Badge'
import { CardSkeleton, TableSkeleton } from '@/components/dashboard/Loaders'
import { ErrorState, EmptyState } from '@/components/dashboard/States'
import { api } from '@/lib/api'
import { formatDate } from '@/lib/date'
import type { PupilStats, StaffStats, StaffView } from '@/types/portal'

function greeting(): string {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}

function activityLabel(action: string): string {
  const labels: Record<string, string> = {
    'staff.create': 'Created a staff account',
    'staff.update': 'Updated a staff account',
    'staff.activate': 'Activated a staff account',
    'staff.deactivate': 'Deactivated a staff account',
    'staff.assign_role': 'Assigned a staff role',
    'staff.remove_role': 'Removed a staff role',
    'staff.invitation.resend': 'Resent a staff invitation',
  }
  return labels[action] ?? action.replace(/\./g, ' ')
}

export function HeadteacherDashboardPage() {
  const { user, hasPermission } = useAuth()
  const [staff, setStaff] = useState<StaffView[] | null>(null)
  const [stats, setStats] = useState<StaffStats | null>(null)
  const [pupilStats, setPupilStats] = useState<PupilStats | null>(null)
  const [error, setError] = useState<string | null>(null)

  const canViewPupils = hasPermission('pupils.view')

  const load = useCallback(async () => {
    setError(null)
    try {
      const [staffData, statsData, pupilData] = await Promise.all([
        api.listStaff(),
        api.staffStats(),
        canViewPupils ? api.pupilStats() : Promise.resolve(null),
      ])
      setStaff(staffData)
      setStats(statsData)
      setPupilStats(pupilData)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load the dashboard.')
    }
  }, [canViewPupils])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Headteacher Dashboard"
        title={`${greeting()}, ${user?.fullName.split(' ')[0] ?? 'Headteacher'}`}
        description={`Prime Royal Preparatory School — operational management of teaching and non-teaching staff. Staff ID ${user?.staffId ?? '—'}.`}
      />

      {error ? (
        <ErrorState message={error} onRetry={() => void load()} />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {stats ? (
              <>
                <StatCard
                  label="Total Staff"
                  value={stats.total}
                  hint="Teaching and non-teaching accounts"
                  icon={<Users className="h-5 w-5" aria-hidden="true" />}
                  tone="royal"
                />
                {canViewPupils ? (
                  <StatCard
                    label="Total Pupils"
                    value={pupilStats?.total ?? 0}
                    hint={
                      pupilStats
                        ? `${pupilStats.active} active · ${pupilStats.inactive} inactive`
                        : '—'
                    }
                    icon={<BookOpenCheck className="h-5 w-5" aria-hidden="true" />}
                    tone="magenta"
                  />
                ) : null}
                <StatCard
                  label="Teaching Staff"
                  value={stats.teaching}
                  hint="Class teachers & subject teachers"
                  icon={<BookOpen className="h-5 w-5" aria-hidden="true" />}
                  tone="magenta"
                />
                <StatCard
                  label="Non-Teaching Staff"
                  value={stats.nonTeaching}
                  hint="Administration & support"
                  icon={<Building2 className="h-5 w-5" aria-hidden="true" />}
                  tone="gold"
                />
                <StatCard
                  label="Active Accounts"
                  value={stats.active}
                  hint={stats.inactive > 0 ? `${stats.inactive} inactive account(s)` : 'All accounts active'}
                  icon={<UserRound className="h-5 w-5" aria-hidden="true" />}
                  tone="green"
                />
              </>
            ) : (
              Array.from({ length: 4 }).map((_, index) => <CardSkeleton key={index} />)
            )}
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            {/* Quick actions */}
            <Card className="p-6">
              <h2 className="text-sm font-bold uppercase tracking-wider text-ink-500">Quick Actions</h2>
              <ul className="mt-4 space-y-1">
                {[
                  { label: 'Manage Teaching Staff', to: '/headteacher/staff?filter=TEACHING', icon: BookOpen },
                  { label: 'Manage Non-Teaching Staff', to: '/headteacher/staff?filter=NON_TEACHING', icon: Building2 },
                  ...(canViewPupils
                    ? [
                        { label: 'Manage Pupils', to: '/headteacher/pupils', icon: BookOpenCheck },
                        { label: 'Manage Classes', to: '/headteacher/classes', icon: BookOpen },
                      ]
                    : []),
                  { label: 'Staff Roles', to: '/headteacher/roles', icon: ShieldCheck },
                  { label: 'My Profile', to: '/headteacher/profile', icon: UserRound },
                ].map(({ label, to, icon: Icon }) => (
                  <li key={label}>
                    <Link
                      to={to}
                      className="group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-ink-700 transition-colors hover:bg-cream-100 hover:text-magenta-600"
                    >
                      <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-royal-600/10 text-royal-600">
                        <Icon className="h-4.5 w-4.5" aria-hidden="true" />
                      </span>
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

            {/* Staff overview */}
            <Card className="p-6">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold uppercase tracking-wider text-ink-500">Staff Overview</h2>
                <Users className="h-5 w-5 text-royal-500" aria-hidden="true" />
              </div>
              <div className="mt-4">
                {staff === null ? (
                  <TableSkeleton rows={4} />
                ) : staff.length === 0 ? (
                  <EmptyState
                    title="No staff members found."
                    description="Teaching and non-teaching staff you manage will appear here."
                    action={
                      <Link
                        to="/headteacher/staff"
                        className="rounded-full bg-magenta-500 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-magenta-600"
                      >
                        Go to Staff
                      </Link>
                    }
                  />
                ) : (
                  <ul className="space-y-3">
                    {staff.slice(0, 5).map((entry) => (
                      <li key={entry.id} className="flex items-center gap-3">
                        <Avatar name={entry.fullName} size="sm" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-bold text-ink-900">{entry.fullName}</p>
                          <p className="truncate text-xs text-ink-500">
                            {entry.staffId} · {entry.roles.join(', ')}
                          </p>
                        </div>
                        <StatusBadge status={entry.status} />
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </Card>
          </div>

          {/* Pupils overview */}
          {canViewPupils ? (
            <Card className="p-6">
              <div className="flex items-center justify-between">
                <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-ink-500">
                  <BookOpenCheck className="h-5 w-5 text-royal-500" aria-hidden="true" />
                  Pupils Overview
                </h2>
                <Link
                  to="/headteacher/pupils"
                  className="inline-flex items-center gap-1.5 text-sm font-semibold text-magenta-600 transition-colors hover:text-magenta-700"
                >
                  Manage pupils <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
              </div>
              {pupilStats === null ? (
                <div className="mt-6 space-y-3">
                  <TableSkeleton rows={4} />
                </div>
              ) : pupilStats.byClass.length === 0 ? (
                <EmptyState
                  title="No pupils registered yet."
                  description="Registered pupils grouped by class will appear here."
                  action={
                    <Link
                      to="/headteacher/pupils"
                      className="rounded-full bg-magenta-500 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-magenta-600"
                    >
                      Register pupils
                    </Link>
                  }
                />
              ) : (
                <>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {pupilStats.byClass.map((entry) => (
                      <div
                        key={entry.classId}
                        className="rounded-xl border border-cream-200 bg-cream-50 p-4"
                      >
                        <p className="text-xs font-semibold uppercase tracking-wider text-ink-500">
                          {entry.className}
                        </p>
                        <p className="mt-1 text-lg font-bold text-ink-900">
                          {entry.count}
                          <span className="ml-1 text-xs font-medium text-ink-500">pupil(s)</span>
                        </p>
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 border-t border-cream-200 pt-3">
                    <p className="text-xs leading-relaxed text-ink-500">
                      {pupilStats.total} registered pupils across the classes you manage.
                    </p>
                  </div>
                </>
              )}
            </Card>
          ) : null}

          {/* Recent staff activity */}
          <Card className="p-6">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold uppercase tracking-wider text-ink-500">Recent Staff Activity</h2>
              <ShieldCheck className="h-5 w-5 text-royal-500" aria-hidden="true" />
            </div>
            <div className="mt-4">
              {stats === null ? (
                <TableSkeleton rows={4} />
              ) : stats.recentActivity.length === 0 ? (
                <EmptyState
                  title="No staff activity yet."
                  description="Actions you take on teaching and non-teaching staff accounts will appear here."
                />
              ) : (
                <ul className="space-y-3">
                  {stats.recentActivity.map((entry) => (
                    <li key={entry.id} className="flex items-start gap-3">
                      <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-magenta-500" aria-hidden="true" />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-ink-900">{activityLabel(entry.action)}</p>
                        <p className="truncate text-xs text-ink-500">
                          {entry.actor?.fullName ?? 'System'} · {formatDate(entry.createdAt)}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </Card>
        </>
      )}
    </div>
  )
}