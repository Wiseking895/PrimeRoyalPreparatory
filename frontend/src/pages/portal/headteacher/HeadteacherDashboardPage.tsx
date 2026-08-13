import { useCallback, useEffect, useState } from 'react'
import { ArrowRight, BookOpen, Building2, ShieldCheck, UserRound, Users } from 'lucide-react'
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
import type { StaffView } from '@/types/portal'

function greeting(): string {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}

export function HeadteacherDashboardPage() {
  const { user } = useAuth()
  const [staff, setStaff] = useState<StaffView[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setError(null)
    try {
      setStaff(await api.listStaff())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load the dashboard.')
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const teaching = staff?.filter((entry) => entry.category === 'TEACHING') ?? []
  const nonTeaching = staff?.filter((entry) => entry.category === 'NON_TEACHING') ?? []
  const active = staff?.filter((entry) => entry.status === 'ACTIVE') ?? []
  const inactive = staff?.filter((entry) => entry.status === 'INACTIVE') ?? []

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
            {staff ? (
              <>
                <StatCard
                  label="Total Staff"
                  value={staff.length}
                  hint="Teaching and non-teaching accounts"
                  icon={<Users className="h-5 w-5" aria-hidden="true" />}
                  tone="royal"
                />
                <StatCard
                  label="Teaching Staff"
                  value={teaching.length}
                  hint="Class teachers & subject teachers"
                  icon={<BookOpen className="h-5 w-5" aria-hidden="true" />}
                  tone="magenta"
                />
                <StatCard
                  label="Non-Teaching Staff"
                  value={nonTeaching.length}
                  hint="Administration & support"
                  icon={<Building2 className="h-5 w-5" aria-hidden="true" />}
                  tone="gold"
                />
                <StatCard
                  label="Active Accounts"
                  value={active.length}
                  hint={inactive.length > 0 ? `${inactive.length} inactive account(s)` : 'All accounts active'}
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
        </>
      )}
    </div>
  )
}