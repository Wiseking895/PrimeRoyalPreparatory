import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ArrowRight,
  Banknote,
  CalendarDays,
  ClipboardCheck,
  Construction,
  ListChecks,
  Receipt,
  Users,
  Wallet,
  XCircle,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/auth/AuthContext'
import { EmptyState } from '@/components/dashboard/States'
import { api } from '@/lib/api'
import { cn } from '@/lib/cn'
import { formatMoney } from '@/lib/money'
import { formatDate } from '@/lib/date'
import { financeRoute } from './financeRoute'
import type { FinanceSummaryView, OwnerFinanceOverviewView } from '@/types/portal'

function greeting(): string {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}

type FeeCategory = 'daily' | 'pta' | 'maintenance'

function GlassCard({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn('glass-card p-5', className)}>{children}</div>
}

function GlassInnerCard({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn('glass-card-inner p-4', className)}>{children}</div>
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

function KpiCard({
  icon: Icon,
  label,
  value,
  accent,
  supporting,
  children,
}: {
  icon: typeof Users
  label: string
  value: string | number
  accent?: boolean
  supporting?: string
  children?: React.ReactNode
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
      {children}
    </GlassCard>
  )
}

function ProgressBar({ value, max }: { value: number; max: number }) {
  const pct = max > 0 ? Math.min(Math.round((value / max) * 100), 100) : 0
  return (
    <div className="mt-2 flex items-center gap-2">
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/[0.08]">
        <div
          className="h-full rounded-full"
          style={{
            width: `${pct}%`,
            background: 'linear-gradient(90deg, #E01274, #FF4DA6)',
          }}
        />
      </div>
      <span className="text-[11px] font-bold text-cream-200/70 w-8 text-right">{pct}%</span>
    </div>
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

export function FinanceDashboardPage() {
  const { user } = useAuth()
  const base = financeRoute(user?.roles ?? [])
  const [summary, setSummary] = useState<FinanceSummaryView | null>(null)
  const [finance, setFinance] = useState<OwnerFinanceOverviewView | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [activeCategory, setActiveCategory] = useState<FeeCategory>('daily')

  const load = useCallback(async () => {
    setError(null)
    try {
      const [s, f] = await Promise.all([
        api.financeSummary(),
        api.financeOverview().catch(() => null),
      ])
      setSummary(s)
      setFinance(f)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load the finance dashboard.')
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  // Auto-sync: ensure charges exist for the active session in the background.
  // This is idempotent and safe to run on every dashboard load.
  useEffect(() => {
    void api.ensureCharges().then(() => {
      void load()
    }).catch(() => {})
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const collectionPct = useMemo(() => {
    if (!finance) return 0
    const exp = Number(finance.totals.totalExpected)
    const col = Number(finance.totals.totalCollected)
    return exp > 0 ? Math.round((col / exp) * 100) : 0
  }, [finance])

  const activeClassCount = useMemo(() => {
    if (!finance) return 0
    const ids = new Set<string>()
    for (const row of [...finance.dailyFees, ...finance.ptaFees, ...finance.maintenanceFees]) {
      ids.add(row.classId)
    }
    return ids.size
  }, [finance])

  const activeFeeRows = useMemo(() => {
    if (!finance) return []
    if (activeCategory === 'daily') return finance.dailyFees
    if (activeCategory === 'pta') return finance.ptaFees
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
      {/* ── Page Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-magenta-400">Finance Dashboard</p>
          <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-white sm:text-3xl">
            {greeting()}, {user?.fullName.split(' ')[0] ?? 'Accountant'}
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-cream-200/65">
            Prime Royal Preparatory School — fees, assignments, charges and payment collection at a glance.
          </p>
        </div>
      </div>

      {/* ── Finance KPI Strip ── */}
      {!finance ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <GlassCard key={i}>
              <div className="animate-pulse space-y-2">
                <div className="h-3 w-20 rounded bg-white/[0.06]" />
                <div className="h-8 w-28 rounded bg-white/[0.06]" />
                <div className="h-3 w-24 rounded bg-white/[0.06]" />
              </div>
            </GlassCard>
          ))}
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard
            icon={Receipt}
            label="Total Expected"
            value={formatMoney(finance.totals.totalExpected)}
            accent
            supporting={`${finance.totals.pupilsWithCharges} pupils with charges`}
          />
          <KpiCard
            icon={Banknote}
            label="Total Collected"
            value={formatMoney(finance.totals.totalCollected)}
            supporting={`${finance.totals.pupilsWithPayments} pupils have paid`}
          >
            <ProgressBar value={Number(finance.totals.totalCollected)} max={Number(finance.totals.totalExpected)} />
          </KpiCard>
          <KpiCard
            icon={XCircle}
            label="Outstanding"
            value={formatMoney(finance.totals.totalOutstanding)}
            supporting={`${collectionPct}% collection rate`}
          />
          <KpiCard
            icon={Users}
            label="Active Classes"
            value={activeClassCount}
            supporting={`${finance.totals.totalPupils} total active pupils`}
          />
        </div>
      )}

      {/* ── Fee Tables + Arrears ── */}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          {!finance ? (
            <GlassCard>
              <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <SkeletonRow key={i} />)}</div>
            </GlassCard>
          ) : (
            <>
              {/* Fee category toggle */}
              <div className="mb-3 flex gap-2">
                {([['daily', 'Daily Fees'], ['pta', 'PTA Fees'], ['maintenance', 'Maintenance Fees']] as const).map(([key, label]) => (
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

              <GlassCard>
                <SectionHeader
                  title={activeCategory === 'daily' ? 'Daily Fees by Class' : activeCategory === 'pta' ? 'PTA Fees by Class' : 'Maintenance Fees by Class'}
                  icon={activeCategory === 'daily' ? Banknote : activeCategory === 'pta' ? Wallet : Construction}
                />
                {activeFeeRows.length === 0 ? (
                  <EmptyStateCard
                    title={activeCategory === 'daily' ? 'No daily fee data available yet.' : activeCategory === 'pta' ? 'No PTA fee data available yet.' : 'No maintenance fee data available yet.'}
                  />
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
              </GlassCard>
            </>
          )}
        </div>

        <div className="lg:col-span-1">
          {finance ? (
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
                    {[...finance.dailyFees, ...finance.ptaFees, ...finance.maintenanceFees]
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
          ) : (
            <GlassInnerCard className="h-full">
              <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <SkeletonRow key={i} />)}</div>
            </GlassInnerCard>
          )}
        </div>
      </div>

      {/* ── All Classes Summary Table ── */}
      {finance && (() => {
        const classMap = new Map<string, { className: string; boysPresent: number; boysAbsent: number; girlsPresent: number; girlsAbsent: number; expected: number; collected: number; outstanding: number }>()
        for (const row of [...finance.dailyFees, ...finance.ptaFees, ...finance.maintenanceFees]) {
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

      {/* ── Quick Actions + Academic Period + Recent Payments ── */}
      {summary && (
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Quick actions */}
          <GlassCard>
            <SectionHeader title="Quick Actions" icon={ListChecks} />
            <ul className="space-y-1">
              {[
                { label: 'Fee Structures', to: `${base}/fees`, icon: Receipt },
                { label: 'Reconciliation', to: `${base}/reconciliation`, icon: ClipboardCheck },
                { label: 'Payment History', to: `${base}/payments`, icon: Wallet },
                { label: 'Academic Years & Terms', to: `${base}/sessions`, icon: CalendarDays },
              ].map(({ label, to, icon: Icon }) => (
                <li key={label}>
                  <Link
                    to={to}
                    className="group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-cream-100 transition-colors hover:bg-white/[0.05]"
                  >
                    <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/[0.06] text-cream-200/70">
                      <Icon className="h-4.5 w-4.5" aria-hidden="true" />
                    </span>
                    <span className="flex-1">{label}</span>
                    <ArrowRight
                      className="h-4 w-4 text-cream-200/60 transition-transform group-hover:translate-x-0.5"
                      aria-hidden="true"
                    />
                  </Link>
                </li>
              ))}
            </ul>
          </GlassCard>

          {/* Academic period */}
          <GlassCard>
            <SectionHeader title="Academic Period" icon={CalendarDays} />
            {!summary.session && !summary.term ? (
              <EmptyState
                title="No academic period configured."
                description="Create an academic year and term to start billing fees."
              />
            ) : (
              <div className="space-y-3">
                <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-3.5">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-cream-200/60">Academic Year</p>
                  <p className="mt-1 text-sm font-extrabold text-cream-100">
                    {summary.session?.name ?? 'No active academic year'}
                  </p>
                  {summary.session && (
                    <p className="mt-1 text-[12px] text-cream-200/60">
                      {formatDate(summary.session.startDate)} — {formatDate(summary.session.endDate)} ·{' '}
                      {summary.session.termCount} term{summary.session.termCount === 1 ? '' : 's'}
                    </p>
                  )}
                </div>
                <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-3.5">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-cream-200/60">Term</p>
                  <p className="mt-1 text-sm font-extrabold text-cream-100">
                    {summary.term?.name ?? 'No active term'}
                  </p>
                  {summary.term && (
                    <p className="mt-1 text-[12px] text-cream-200/60">
                      {formatDate(summary.term.startDate)} — {formatDate(summary.term.endDate)} ·{' '}
                      {summary.term.schoolDays} school days
                    </p>
                  )}
                </div>
                <Link
                  to={`${base}/sessions`}
                  className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-magenta-400 hover:text-magenta-300"
                >
                  Manage academic years &rarr;
                </Link>
              </div>
            )}
          </GlassCard>

          {/* Recent payments */}
          <GlassCard>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <Wallet className="h-4 w-4 text-magenta-400/60" aria-hidden="true" />
                <h2 className="text-sm font-bold text-cream-100">Recent Payments</h2>
              </div>
              <Link
                to={`${base}/payments`}
                className="text-[12px] font-semibold text-magenta-400 hover:text-magenta-300"
              >
                View all &rarr;
              </Link>
            </div>
            <div>
              {summary.recentPayments.length === 0 ? (
                <EmptyState
                  title="No payments recorded yet."
                  description="Payments recorded for active fee charges will appear here."
                />
              ) : (
                <ul className="space-y-3">
                  {summary.recentPayments.map((payment) => (
                    <li key={payment.id} className="flex items-start gap-3">
                      <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-emerald-500" aria-hidden="true" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-cream-100">
                          {payment.pupilName} — {formatMoney(payment.amountPaid)}
                        </p>
                        <p className="truncate text-xs text-cream-200/65">
                          {payment.paymentReference} · {payment.paymentMethod.replace('_', ' ')} ·{' '}
                          {formatDate(payment.paymentDate)}
                        </p>
                      </div>
                      <span
                        className={cn(
                          'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 ring-inset',
                          payment.status === 'VOIDED'
                            ? 'bg-red-500/10 text-red-300 ring-red-500/20'
                            : 'bg-emerald-500/10 text-emerald-300 ring-emerald-500/20',
                        )}
                      >
                        <span className={cn('h-1.5 w-1.5 rounded-full', payment.status === 'VOIDED' ? 'bg-red-400' : 'bg-emerald-400')} />
                        {payment.status === 'VOIDED' ? 'Voided' : 'Active'}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </GlassCard>
        </div>
      )}
    </div>
  )
}
