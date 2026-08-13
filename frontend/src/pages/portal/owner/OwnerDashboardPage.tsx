import { useCallback, useEffect, useState } from 'react'
import {
  ArrowRight,
  BookOpen,
  Building2,
  ClipboardList,
  ScrollText,
  ShieldCheck,
  UserCog,
  UserRound,
  Users,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/auth/AuthContext'
import { PageHeader } from '@/components/dashboard/PageHeader'
import { StatCard } from '@/components/dashboard/StatCard'
import { Card } from '@/components/ui/Card'
import { Avatar } from '@/components/dashboard/Avatar'
import { StatusBadge, Badge } from '@/components/dashboard/Badge'
import { CardSkeleton, TableSkeleton } from '@/components/dashboard/Loaders'
import { ErrorState, EmptyState } from '@/components/dashboard/States'
import { api } from '@/lib/api'
import type { AuditEntry, OwnerSummary, StaffView } from '@/types/portal'
import { formatDate } from '@/lib/date'

function greeting(): string {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}

export function OwnerDashboardPage() {
  const { user } = useAuth()
  const [summary, setSummary] = useState<OwnerSummary | null>(null)
  const [staff, setStaff] = useState<StaffView[] | null>(null)
  const [audit, setAudit] = useState<AuditEntry[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setError(null)
    try {
      const [summaryData, staffData, auditData] = await Promise.all([
        api.ownerSummary(),
        api.listStaff(),
        api.listAudit(5, 0),
      ])
      setSummary(summaryData)
      setStaff(staffData)
      setAudit(auditData.entries)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load the dashboard.')
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const teachingCount = staff?.filter((entry) => entry.category === 'TEACHING').length ?? 0
  const nonTeachingCount = staff?.filter((entry) => entry.category === 'NON_TEACHING').length ?? 0
  const headteacher = summary?.headteacher ?? null

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Owner Dashboard"
        title={`${greeting()}, Owner`}
        description="Prime Royal Preparatory School — overall account and Headteacher management."
      />

      {error ? (
        <ErrorState message={error} onRetry={() => void load()} />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {summary ? (
              <>
                <StatCard
                  label="Headteacher Account"
                  value={headteacher ? headteacher.fullName : 'None yet'}
                  hint={
                    headteacher
                      ? headteacher.status === 'ACTIVE'
                        ? 'Active overall Headteacher'
                        : 'Deactivated'
                      : 'No Headteacher created'
                  }
                  icon={<UserCog className="h-5 w-5" aria-hidden="true" />}
                  tone="royal"
                />
                <StatCard
                  label="Active Staff"
                  value={summary.totals.staff}
                  hint="Teaching and non-teaching accounts"
                  icon={<Users className="h-5 w-5" aria-hidden="true" />}
                  tone="green"
                />
                <StatCard
                  label="Teaching Staff"
                  value={staff ? teachingCount : '—'}
                  hint={staff ? 'Current staff records' : 'Loading staff…'}
                  icon={<BookOpen className="h-5 w-5" aria-hidden="true" />}
                  tone="magenta"
                />
                <StatCard
                  label="Non-Teaching Staff"
                  value={staff ? nonTeachingCount : '—'}
                  hint={staff ? 'Current staff records' : 'Loading staff…'}
                  icon={<Building2 className="h-5 w-5" aria-hidden="true" />}
                  tone="gold"
                />
              </>
            ) : (
              Array.from({ length: 4 }).map((_, index) => <CardSkeleton key={index} />)
            )}
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            {/* Quick actions */}
            <Card className="p-6">
              <h2 className="text-sm font-bold uppercase tracking-wider text-ink-500">Quick Actions</h2>
              <ul className="mt-4 space-y-1">
                {[
                  {
                    label: headteacher ? 'Manage Headteacher' : 'Create Headteacher',
                    to: headteacher ? `/owner/headteacher/${headteacher.id}` : '/owner/headteacher',
                    icon: UserCog,
                  },
                  { label: 'View Staff', to: '/owner/staff', icon: Users },
                  { label: 'Roles & Permissions', to: '/owner/roles', icon: ShieldCheck },
                  { label: 'Audit Activity', to: '/owner/audit', icon: ScrollText },
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

            {/* Headteacher status */}
            <Card className="p-6">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold uppercase tracking-wider text-ink-500">Headteacher</h2>
                <UserCog className="h-5 w-5 text-royal-500" aria-hidden="true" />
              </div>
              {summary === null ? (
                <div className="mt-6 space-y-3">
                  <CardSkeleton className="border-0 p-0" />
                </div>
              ) : headteacher ? (
                <div className="mt-5 flex items-center gap-4">
                  <Avatar name={headteacher.fullName} size="lg" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-base font-bold text-ink-900">{headteacher.fullName}</p>
                    <p className="truncate text-sm text-ink-500">
                      {headteacher.staffId} · {headteacher.email}
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <StatusBadge status={headteacher.status} />
                      <Badge tone="royal">{headteacher.permissions.length} permissions</Badge>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="mt-5">
                  <EmptyState
                    icon={<UserCog className="h-7 w-7" aria-hidden="true" />}
                    title="No Headteacher account has been created yet."
                    description="Create the overall Headteacher account to hand over day-to-day school operations."
                    action={
                      <Link
                        to="/owner/headteacher"
                        className="rounded-full bg-magenta-500 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-magenta-600"
                      >
                        Create Headteacher
                      </Link>
                    }
                  />
                </div>
              )}

              {headteacher ? (
                <div className="mt-5 border-t border-cream-200 pt-4">
                  <Link
                    to={`/owner/headteacher/${headteacher.id}`}
                    className="inline-flex items-center gap-2 text-sm font-semibold text-magenta-600 transition-colors hover:text-magenta-700"
                  >
                    Manage account & permissions <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </Link>
                </div>
              ) : null}
            </Card>

            {/* Recent activity */}
            <Card className="p-6">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold uppercase tracking-wider text-ink-500">Recent Activity</h2>
                <ScrollText className="h-5 w-5 text-royal-500" aria-hidden="true" />
              </div>
              <div className="mt-4">
                {audit === null ? (
                  <TableSkeleton rows={4} />
                ) : audit.length === 0 ? (
                  <EmptyState title="No audit activity available." />
                ) : (
                  <ul className="space-y-3">
                    {audit.map((entry) => (
                      <li key={entry.id} className="flex items-start gap-3">
                        <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-magenta-500" aria-hidden="true" />
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-ink-900">
                            {entry.actor?.fullName ?? 'System'} — {entry.action}
                          </p>
                          <p className="text-xs text-ink-500">{formatDate(entry.createdAt)}</p>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </Card>
          </div>

          {/* Pending actions */}
          <Card className="p-6">
            <div className="flex items-center gap-2">
              <ClipboardList className="h-5 w-5 text-royal-500" aria-hidden="true" />
              <h2 className="text-sm font-bold uppercase tracking-wider text-ink-500">Pending Actions</h2>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {!headteacher ? (
                <div className="flex items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
                  <div className="flex items-center gap-3">
                    <UserRound className="h-5 w-5 text-amber-600" aria-hidden="true" />
                    <p className="text-sm font-semibold text-ink-900">Create the Headteacher account</p>
                  </div>
                  <Link
                    to="/owner/headteacher"
                    className="text-sm font-semibold text-magenta-600 hover:text-magenta-700"
                  >
                    Start
                  </Link>
                </div>
              ) : (
                <div className="flex items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                  <div className="flex items-center gap-3">
                    <UserRound className="h-5 w-5 text-emerald-600" aria-hidden="true" />
                    <p className="text-sm font-semibold text-ink-900">Headteacher account is set up</p>
                  </div>
                  <Link
                    to={`/owner/headteacher/${headteacher.id}`}
                    className="text-sm font-semibold text-magenta-600 hover:text-magenta-700"
                  >
                    Review
                  </Link>
                </div>
              )}
              <div className="flex items-center justify-between gap-3 rounded-xl border border-cream-300 bg-white p-4">
                <div className="flex items-center gap-3">
                  <UserRound className="h-5 w-5 text-royal-500" aria-hidden="true" />
                  <p className="text-sm font-semibold text-ink-900">Staff overview</p>
                </div>
                <Link to="/owner/staff" className="text-sm font-semibold text-magenta-600 hover:text-magenta-700">
                  Manage
                </Link>
              </div>
            </div>
          </Card>
        </>
      )}
    </div>
  )
}