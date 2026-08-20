import { useCallback, useEffect, useState } from 'react'
import {
  ArrowRight,
  BookOpen,
  BookOpenCheck,
  Building2,
  ClipboardList,
  ScrollText,
  ShieldCheck,
  UserCog,
  UserRound,
  Users,
  Wallet,
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
import { formatMoney } from '@/lib/money'
import type { AuditEntry, FinanceSummaryView, OwnerSummary } from '@/types/portal'
import { formatDate } from '@/lib/date'

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
    'owner.headteacher.create': 'Created the Headteacher account',
    'owner.headteacher.update': 'Updated the Headteacher account',
    'owner.headteacher.activate': 'Activated the Headteacher account',
    'owner.headteacher.deactivate': 'Deactivated the Headteacher account',
    'owner.headteacher.permissions.update': 'Changed Headteacher permissions',
    'owner.headteacher.invitation.resend': 'Resent the Headteacher invitation',
  }
  return labels[action] ?? action.replace(/\./g, ' ')
}

export function OwnerDashboardPage() {
  const { hasPermission } = useAuth()
  const [summary, setSummary] = useState<OwnerSummary | null>(null)
  const [finance, setFinance] = useState<FinanceSummaryView | null>(null)
  const [audit, setAudit] = useState<AuditEntry[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  const canViewFinance = hasPermission('finance.view')

  const load = useCallback(async () => {
    setError(null)
    try {
      const [summaryData, auditData, financeData] = await Promise.all([
        api.ownerSummary(),
        api.listAudit(5, 0),
        canViewFinance ? api.financeSummary() : Promise.resolve(null),
      ])
      setSummary(summaryData)
      setAudit(auditData.entries)
      setFinance(financeData)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load the dashboard.')
    }
  }, [canViewFinance])

  useEffect(() => {
    void load()
  }, [load])

  const headteacher = summary?.headteacher ?? null
  const canViewPupils = hasPermission('pupils.view')

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
                {canViewPupils ? (
                  <StatCard
                    label="Total Pupils"
                    value={summary.totals.pupils}
                    hint={`${summary.totals.activePupils} active · ${summary.totals.inactivePupils} inactive`}
                    icon={<BookOpenCheck className="h-5 w-5" aria-hidden="true" />}
                    tone="magenta"
                  />
                ) : null}
                <StatCard
                  label="Active Staff"
                  value={summary.totals.activeStaff}
                  hint={summary.totals.inactiveStaff > 0 ? `${summary.totals.inactiveStaff} inactive account(s)` : 'All teaching & non-teaching accounts active'}
                  icon={<Users className="h-5 w-5" aria-hidden="true" />}
                  tone="green"
                />
                <StatCard
                  label="Teaching Staff"
                  value={summary.totals.teaching}
                  hint="Current teaching records"
                  icon={<BookOpen className="h-5 w-5" aria-hidden="true" />}
                  tone="magenta"
                />
                <StatCard
                  label="Non-Teaching Staff"
                  value={summary.totals.nonTeaching}
                  hint="Current non-teaching records"
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
                  ...(canViewPupils
                    ? [
                        { label: 'Manage Pupils', to: '/owner/pupils', icon: BookOpenCheck },
                        { label: 'Manage Classes', to: '/owner/classes', icon: BookOpen },
                      ]
                    : []),
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
                      {headteacher.mustChangePassword ? <Badge tone="amber">Awaiting password change</Badge> : null}
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
                            {entry.actor?.fullName ?? 'System'} — {activityLabel(entry.action)}
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

          <div className="grid gap-6 lg:grid-cols-2">
            {/* Headteacher overview */}
            <Card className="p-6">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold uppercase tracking-wider text-ink-500">Headteacher Overview</h2>
                <ShieldCheck className="h-5 w-5 text-royal-500" aria-hidden="true" />
              </div>
              {summary === null ? (
                <div className="mt-6 space-y-3">
                  <CardSkeleton className="border-0 p-0" />
                </div>
              ) : headteacher ? (
                <div className="mt-4">
                  <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
                    <div>
                      <dt className="text-xs font-semibold uppercase tracking-wider text-ink-500">Name</dt>
                      <dd className="mt-0.5 font-bold text-ink-900">{headteacher.fullName}</dd>
                    </div>
                    <div>
                      <dt className="text-xs font-semibold uppercase tracking-wider text-ink-500">Headteacher ID</dt>
                      <dd className="mt-0.5 font-bold text-ink-900">{headteacher.staffId ?? '—'}</dd>
                    </div>
                    <div>
                      <dt className="text-xs font-semibold uppercase tracking-wider text-ink-500">Account status</dt>
                      <dd className="mt-0.5">
                        <StatusBadge status={headteacher.status} />
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs font-semibold uppercase tracking-wider text-ink-500">Last login</dt>
                      <dd className="mt-0.5 text-ink-900">{headteacher.lastLoginAt ? formatDate(headteacher.lastLoginAt) : 'Never signed in'}</dd>
                    </div>
                    <div>
                      <dt className="text-xs font-semibold uppercase tracking-wider text-ink-500">Account created</dt>
                      <dd className="mt-0.5 text-ink-900">{formatDate(headteacher.createdAt)}</dd>
                    </div>
                    <div>
                      <dt className="text-xs font-semibold uppercase tracking-wider text-ink-500">Staff managed</dt>
                      <dd className="mt-0.5 text-ink-900">
                        {summary.totals.teaching} teaching · {summary.totals.nonTeaching} non-teaching
                      </dd>
                    </div>
                  </dl>

                  {summary.recentPermissionChanges.length > 0 ? (
                    <div className="mt-5 border-t border-cream-200 pt-4">
                      <p className="text-xs font-bold uppercase tracking-wider text-ink-500">Recent permission changes</p>
                      <ul className="mt-2 space-y-2">
                        {summary.recentPermissionChanges.slice(0, 3).map((entry) => (
                          <li key={entry.id} className="flex items-start gap-2 text-sm">
                            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-royal-500" aria-hidden="true" />
                            <span className="min-w-0 text-ink-700">
                              {activityLabel(entry.action)} — {entry.actor?.fullName ?? 'System'}
                              <span className="text-xs text-ink-500"> · {formatDate(entry.createdAt)}</span>
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </div>
              ) : (
                <EmptyState
                  title="No Headteacher yet."
                  description="Create the Headteacher account to enable staff management."
                />
              )}
            </Card>

            {/* Staff activity */}
            <Card className="p-6">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold uppercase tracking-wider text-ink-500">Staff Management Activity</h2>
                <Users className="h-5 w-5 text-royal-500" aria-hidden="true" />
              </div>
              {summary === null ? (
                <div className="mt-6 space-y-3">
                  <CardSkeleton className="border-0 p-0" />
                </div>
              ) : summary.recentStaffActivity.length === 0 ? (
                <EmptyState
                  title="No staff activity yet."
                  description="Teaching and non-teaching staff actions taken by the Headteacher will appear here."
                />
              ) : (
                <ul className="mt-4 space-y-3">
                  {summary.recentStaffActivity.map((entry) => (
                    <li key={entry.id} className="flex items-start gap-3">
                      <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-magenta-500" aria-hidden="true" />
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-ink-900">{activityLabel(entry.action)}</p>
                        <p className="truncate text-xs text-ink-500">
                          {entry.actor?.fullName ?? 'System'} · {formatDate(entry.createdAt)}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              <div className="mt-4 border-t border-cream-200 pt-3">
                <p className="text-xs leading-relaxed text-ink-500">
                  The Headteacher is responsible for day-to-day management of teaching and non-teaching
                  staff. This panel gives you oversight of that activity.
                </p>
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
                  to="/owner/pupils"
                  className="inline-flex items-center gap-1.5 text-sm font-semibold text-magenta-600 transition-colors hover:text-magenta-700"
                >
                  Manage pupils <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
              </div>
              {summary === null ? (
                <div className="mt-6 space-y-3">
                  <CardSkeleton className="border-0 p-0" />
                </div>
              ) : summary.pupilsByClass.length === 0 ? (
                <EmptyState
                  title="No pupils registered yet."
                  description="Registered pupils grouped by class will appear here."
                  action={
                    <Link
                      to="/owner/pupils"
                      className="rounded-full bg-magenta-500 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-magenta-600"
                    >
                      Register pupils
                    </Link>
                  }
                />
              ) : (
                <>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {summary.pupilsByClass.map((entry) => (
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
                      {summary.totals.pupils} registered pupils across {summary.totals.classes} class
                      levels. Pupil records are managed by the Headteacher and class teachers.
                    </p>
                  </div>
                </>
              )}
            </Card>
          ) : null}

          {/* Finance overview */}
          {canViewFinance ? (
            <Card className="p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Wallet className="h-5 w-5 text-gold-500" aria-hidden="true" />
                  <h2 className="text-sm font-bold uppercase tracking-wider text-ink-500">Finance Overview</h2>
                </div>
                <Link
                  to="/owner/finance"
                  className="inline-flex items-center gap-1.5 text-sm font-semibold text-magenta-600 transition-colors hover:text-magenta-700"
                >
                  Open finance <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
              </div>
              {finance === null ? (
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <CardSkeleton className="border-0 p-0" />
                  <CardSkeleton className="border-0 p-0" />
                </div>
              ) : (
                <>
                  <div className="mt-4 grid gap-3 sm:grid-cols-3">
                    <div className="rounded-xl border border-cream-200 bg-cream-50 p-4">
                      <p className="text-xs font-semibold uppercase tracking-wider text-ink-500">Expected Fees</p>
                      <p className="mt-1 text-lg font-bold text-ink-900">{formatMoney(finance.expectedFees)}</p>
                    </div>
                    <div className="rounded-xl border border-cream-200 bg-cream-50 p-4">
                      <p className="text-xs font-semibold uppercase tracking-wider text-ink-500">Collected</p>
                      <p className="mt-1 text-lg font-bold text-emerald-700">{formatMoney(finance.collected)}</p>
                    </div>
                    <div className="rounded-xl border border-cream-200 bg-cream-50 p-4">
                      <p className="text-xs font-semibold uppercase tracking-wider text-ink-500">Outstanding</p>
                      <p className="mt-1 text-lg font-bold text-red-700">{formatMoney(finance.outstanding)}</p>
                    </div>
                  </div>
                  <p className="mt-3 text-xs leading-relaxed text-ink-500">
                    {finance.pupilsWithOutstanding} pupil(s) carry an outstanding balance across{' '}
                    {finance.feeSummary.total} fee structures. The Accountant manages day-to-day collections.
                  </p>
                </>
              )}
            </Card>
          ) : null}

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