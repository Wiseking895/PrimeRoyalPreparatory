import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Banknote,
  Clock,
  Coins,
  Construction,
  Receipt,
  Wallet,
  XCircle,
} from 'lucide-react'
import { useAuth } from '@/auth/AuthContext'
import { api } from '@/lib/api'
import { cn } from '@/lib/cn'
import { formatMoney } from '@/lib/money'
import type { OwnerFinanceClassRow, OwnerFinanceOverviewView } from '@/types/portal'

// ── Shared small components ────────────────────────────────────────────

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
  icon: typeof Wallet
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
  supporting,
  children,
}: {
  icon: typeof Wallet
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
          {supporting && <p className="mt-1 text-[11px] text-cream-200/30">{supporting}</p>}
        </div>
      </div>
      {children}
    </GlassCard>
  )
}

function ProgressBar({ value, max }: { value: number; max: number }) {
  const pct = max > 0 ? Math.min(Math.round((value / max) * 100), 100) : 0
  return (
    <div className="flex items-center gap-2 mt-2">
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/[0.08]">
        <div
          className="h-full rounded-full"
          style={{
            width: `${pct}%`,
            background: 'linear-gradient(90deg, #E01274, #FF4DA6)',
          }}
        />
      </div>
      <span className="text-[11px] font-bold text-cream-200/50 w-8 text-right">{pct}%</span>
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
      <p className="text-sm font-semibold text-cream-200/50">{title}</p>
      {description && <p className="mt-1 text-[12px] text-cream-200/30">{description}</p>}
    </div>
  )
}

// ── Fee table (reusable for Daily / PTA / Maintenance) ────────────────

function FeeTable({
  title,
  icon: Icon,
  rows,
  totalExpected,
  totalCollected,
  totalOutstanding,
  emptyMessage,
}: {
  title: string
  icon: typeof Wallet
  rows: OwnerFinanceClassRow[]
  totalExpected: string
  totalCollected: string
  totalOutstanding: string
  emptyMessage: string
}) {
  const totalExpectedNum = Number(totalExpected)
  const totalCollectedNum = Number(totalCollected)

  return (
    <GlassCard>
      <SectionHeader title={title} icon={Icon} />
      {rows.length === 0 ? (
        <EmptyStateCard title={emptyMessage} />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[13px]">
            <thead>
              <tr className="border-b border-white/[0.06]">
                <th className="pb-2 pr-4 text-[11px] font-bold uppercase tracking-wider text-cream-200/35">Class</th>
                <th className="pb-2 pr-4 text-[11px] font-bold uppercase tracking-wider text-cream-200/35 text-right">Pupils</th>
                <th className="pb-2 pr-4 text-[11px] font-bold uppercase tracking-wider text-cream-200/35 text-right">Expected</th>
                <th className="pb-2 pr-4 text-[11px] font-bold uppercase tracking-wider text-cream-200/35 text-right">Collected</th>
                <th className="pb-2 text-[11px] font-bold uppercase tracking-wider text-cream-200/35 text-right">Outstanding</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.classId} className="border-b border-white/[0.04]">
                  <td className="py-2.5 pr-4 font-semibold text-cream-100">{row.className}</td>
                  <td className="py-2.5 pr-4 text-right text-cream-200/60">{row.pupilCount}</td>
                  <td className="py-2.5 pr-4 text-right text-cream-200/60">{formatMoney(row.expectedAmount)}</td>
                  <td className="py-2.5 pr-4 text-right font-semibold text-emerald-400">{formatMoney(row.collectedAmount)}</td>
                  <td className="py-2.5 text-right font-semibold text-red-400">{formatMoney(row.outstandingAmount)}</td>
                </tr>
              ))}
              <tr className="border-t border-magenta-500/20">
                <td colSpan={2} className="pt-3 pr-4 text-[12px] font-bold text-magenta-300">Total</td>
                <td className="pt-3 pr-4 text-right text-[12px] font-bold text-magenta-300">{formatMoney(totalExpected)}</td>
                <td className="pt-3 pr-4 text-right text-[12px] font-bold text-magenta-300">{formatMoney(totalCollected)}</td>
                <td className="pt-3 text-right text-[12px] font-extrabold text-magenta-300">{formatMoney(totalOutstanding)}</td>
              </tr>
            </tbody>
          </table>
          <div className="mt-3">
            <ProgressBar value={totalCollectedNum} max={totalExpectedNum} />
          </div>
        </div>
      )}
    </GlassCard>
  )
}

// ── Fee category toggle pills ──────────────────────────────────────────

type FeeCategory = 'daily' | 'pta' | 'maintenance' | 'pa'

function FeeToggle({
  active,
  onChange,
}: {
  active: FeeCategory
  onChange: (cat: FeeCategory) => void
}) {
  const options: Array<{ key: FeeCategory; label: string }> = [
    { key: 'daily', label: 'Daily Fees' },
    { key: 'pta', label: 'PTA Fees' },
    { key: 'pa', label: 'PA Fees' },
    { key: 'maintenance', label: 'Maintenance Fees' },
  ]
  return (
    <div className="flex gap-2">
      {options.map((opt) => (
        <button
          key={opt.key}
          type="button"
          onClick={() => onChange(opt.key)}
          className={cn(
            'rounded-full px-3 py-1 text-[11px] font-semibold transition-colors',
            active === opt.key
              ? 'bg-magenta-500/20 text-magenta-300 ring-1 ring-magenta-500/30'
              : 'bg-white/[0.05] text-cream-200/40 hover:bg-white/[0.08] hover:text-cream-200/60',
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}

// ── Outstanding Arrears panel ──────────────────────────────────────────

function ArrearsPanel({
  summary,
}: {
  summary: OwnerFinanceOverviewView
}) {
  const hasArrears = Number(summary.totals.totalOutstanding) > 0
  return (
    <GlassCard className="h-full">
      <SectionHeader title="Outstanding Arrears" icon={XCircle} />
      {!hasArrears ? (
        <EmptyStateCard title="No outstanding arrears." />
      ) : (
        <>
          <div className="space-y-2.5 mb-4">
            {/* Aggregate by class from all fee types */}
            {[...summary.dailyFees, ...summary.ptaFees, ...summary.maintenanceFees, ...summary.paFees]
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
                    <p className="text-[10px] text-cream-200/30">{row.pupilCount} pupils with charges</p>
                  </div>
                  <span className="text-[12px] font-bold text-red-400">{formatMoney(row.outstandingAmount)}</span>
                </div>
              ))}
          </div>
          <div className="border-t border-white/[0.06] pt-3">
            <div className="flex items-center justify-between">
              <span className="text-[12px] font-bold text-cream-200/50">Total Arrears</span>
              <span className="text-lg font-extrabold text-red-400">{formatMoney(summary.totals.totalOutstanding)}</span>
            </div>
          </div>
        </>
      )}
    </GlassCard>
  )
}

// ── Main page ─────────────────────────────────────────────────────────

export function OwnerFinanceOverviewPage() {
  const { hasPermission } = useAuth()
  const [summary, setSummary] = useState<OwnerFinanceOverviewView | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [activeCategory, setActiveCategory] = useState<FeeCategory>('daily')

  const canViewFinance = hasPermission('finance.view')

  const load = useCallback(async () => {
    setError(null)
    try {
      setSummary(await api.ownerFinanceOverview())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load the finance overview.')
    }
  }, [])

  useEffect(() => {
    if (canViewFinance) void load()
  }, [load, canViewFinance])

  const collectionPct = useMemo(() => {
    if (!summary) return 0
    const exp = Number(summary.totals.totalExpected)
    const col = Number(summary.totals.totalCollected)
    return exp > 0 ? Math.round((col / exp) * 100) : 0
  }, [summary])

  const todayLabel = new Date().toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })

  if (!canViewFinance) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-white/[0.08] bg-white/[0.03] px-6 py-12 text-center">
        <p className="text-sm font-bold text-cream-200/50">Finance access is restricted.</p>
        <p className="mt-1 text-[12px] text-cream-200/30">Contact the Headteacher for access.</p>
      </div>
    )
  }

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
      {/* ── KPI Strip ── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center">
          <SectionBar />
          <Wallet className="h-4 w-4 text-magenta-400/60 mr-2" aria-hidden="true" />
          <h1 className="text-[17px] font-bold text-cream-100">Finance Overview</h1>
        </div>
        <div className="flex items-center gap-2">
          {summary?.term && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.05] px-3 py-1 text-[11px] font-semibold text-cream-200/50 ring-1 ring-white/[0.08]">
              <Clock className="h-3 w-3" aria-hidden="true" />
              {summary.term.name}
            </span>
          )}
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.05] px-3 py-1 text-[11px] font-semibold text-cream-200/50 ring-1 ring-white/[0.08]">
            {todayLabel}
          </span>
        </div>
      </div>

      {!summary ? (
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
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard
            icon={Receipt}
            label="Total Expected"
            value={`GHS ${formatMoney(summary.totals.totalExpected)}`}
            accent
            supporting={`${summary.totals.pupilsWithCharges} pupils with charges`}
          />
          <KpiCard
            icon={Banknote}
            label="Total Collected"
            value={`GHS ${formatMoney(summary.totals.totalCollected)}`}
            supporting={`${summary.totals.pupilsWithPayments} pupils have paid`}
          >
            <ProgressBar value={Number(summary.totals.totalCollected)} max={Number(summary.totals.totalExpected)} />
          </KpiCard>
          <KpiCard
            icon={XCircle}
            label="Outstanding"
            value={`GHS ${formatMoney(summary.totals.totalOutstanding)}`}
            supporting={`${collectionPct}% collection rate`}
          />
          <KpiCard
            icon={Coins}
            label="Active Classes"
            value={summary.dailyFees.length + summary.ptaFees.length + summary.maintenanceFees.length + summary.paFees.length > 0
              ? new Set([...summary.dailyFees, ...summary.ptaFees, ...summary.maintenanceFees, ...summary.paFees].map((r) => r.classId)).size
              : 0}
            supporting={`${summary.totals.totalPupils} total active pupils`}
          />
        </div>
      )}

      {/* ── Fee Tables + Arrears ── */}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          {!summary ? (
            <GlassCard>
              <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <SkeletonRow key={i} />)}</div>
            </GlassCard>
          ) : activeCategory === 'daily' ? (
            <FeeTable
              title="Daily Fees by Class"
              icon={Banknote}
              rows={summary.dailyFees}
              totalExpected={summary.totals.totalExpected}
              totalCollected={summary.totals.totalCollected}
              totalOutstanding={summary.totals.totalOutstanding}
              emptyMessage="No daily fee data available yet."
            />
          ) : activeCategory === 'pta' ? (
            <FeeTable
              title="PTA Fees by Class"
              icon={Wallet}
              rows={summary.ptaFees}
              totalExpected={summary.totals.totalExpected}
              totalCollected={summary.totals.totalCollected}
              totalOutstanding={summary.totals.totalOutstanding}
              emptyMessage="No PTA fee data available yet."
            />
          ) : activeCategory === 'maintenance' ? (
            <FeeTable
              title="Maintenance Fees by Class"
              icon={Construction}
              rows={summary.maintenanceFees}
              totalExpected={summary.totals.totalExpected}
              totalCollected={summary.totals.totalCollected}
              totalOutstanding={summary.totals.totalOutstanding}
              emptyMessage="No maintenance fee data available yet."
            />
          ) : activeCategory === 'pa' ? (
            <FeeTable
              title="PA Fees by Class"
              icon={Coins}
              rows={summary.paFees}
              totalExpected={summary.totals.totalExpected}
              totalCollected={summary.totals.totalCollected}
              totalOutstanding={summary.totals.totalOutstanding}
              emptyMessage="No PA fee data available yet."
            />
          ) : (
            <FeeTable
              title="All Fees by Class"
              icon={Receipt}
              rows={[...summary.dailyFees, ...summary.ptaFees, ...summary.maintenanceFees, ...summary.paFees]}
              totalExpected={summary.totals.totalExpected}
              totalCollected={summary.totals.totalCollected}
              totalOutstanding={summary.totals.totalOutstanding}
              emptyMessage="No fee data available yet."
            />
          )}
        </div>

        <div className="lg:col-span-1">
          {summary ? <ArrearsPanel summary={summary} /> : (
            <GlassCard className="h-full">
              <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <SkeletonRow key={i} />)}</div>
            </GlassCard>
          )}
        </div>
      </div>

      {/* ── Fee Category Toggle ── */}
      {summary && (
        <div className="flex justify-center">
          <FeeToggle active={activeCategory} onChange={setActiveCategory} />
        </div>
      )}

      {/* ── All Classes Summary Table ── */}
      {summary && (() => {
        // Merge all classes across fee types
        const classMap = new Map<string, { className: string; pupilCount: number; expected: number; collected: number; outstanding: number }>()
        for (const row of [...summary.dailyFees, ...summary.ptaFees, ...summary.maintenanceFees]) {
          const existing = classMap.get(row.classId) ?? { className: row.className, pupilCount: 0, expected: 0, collected: 0, outstanding: 0 }
          existing.pupilCount = Math.max(existing.pupilCount, row.pupilCount)
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

        return (
          <GlassCard>
            <SectionHeader title="All Classes — Finance Summary" icon={Receipt}>
              <span className="text-[11px] font-semibold text-cream-200/40">
                {summary.session?.name ?? 'No active session'} &middot; {summary.term?.name ?? 'No active term'}
              </span>
            </SectionHeader>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-[13px]">
                <thead>
                  <tr className="border-b border-white/[0.06]">
                    <th className="pb-2 pr-4 text-[11px] font-bold uppercase tracking-wider text-cream-200/35">Class</th>
                    <th className="pb-2 pr-4 text-[11px] font-bold uppercase tracking-wider text-cream-200/35 text-right">Pupils</th>
                    <th className="pb-2 pr-4 text-[11px] font-bold uppercase tracking-wider text-cream-200/35 text-right">Expected</th>
                    <th className="pb-2 pr-4 text-[11px] font-bold uppercase tracking-wider text-cream-200/35 text-right">Collected</th>
                    <th className="pb-2 text-[11px] font-bold uppercase tracking-wider text-cream-200/35 text-right">Outstanding</th>
                  </tr>
                </thead>
                <tbody>
                  {allRows.map((row) => (
                    <tr key={row.className} className="border-b border-white/[0.04]">
                      <td className="py-2.5 pr-4 font-semibold text-cream-100">{row.className}</td>
                      <td className="py-2.5 pr-4 text-right text-cream-200/60">{row.pupilCount}</td>
                      <td className="py-2.5 pr-4 text-right text-cream-200/60">{formatMoney(row.expected)}</td>
                      <td className="py-2.5 pr-4 text-right font-semibold text-emerald-400">{formatMoney(row.collected)}</td>
                      <td className="py-2.5 text-right font-semibold text-red-400">{formatMoney(row.outstanding)}</td>
                    </tr>
                  ))}
                  <tr className="border-t border-magenta-500/20">
                    <td colSpan={2} className="pt-3 pr-4 text-[12px] font-bold text-magenta-300">School Total</td>
                    <td className="pt-3 pr-4 text-right text-[12px] font-bold text-magenta-300">{formatMoney(grandExpected)}</td>
                    <td className="pt-3 pr-4 text-right text-[12px] font-bold text-magenta-300">{formatMoney(grandCollected)}</td>
                    <td className="pt-3 text-right text-[12px] font-extrabold text-magenta-300">{formatMoney(grandOutstanding)}</td>
                  </tr>
                </tbody>
              </table>
              <div className="mt-3">
                <ProgressBar value={grandCollected} max={grandExpected} />
              </div>
            </div>
          </GlassCard>
        )
      })()}

      {/* ── Footer ── */}
      <p className="text-center text-[10px] text-cream-200/20 pt-2">
        PRPS Owner Finance Overview &middot; Data refreshes on each page load
      </p>
    </div>
  )
}
