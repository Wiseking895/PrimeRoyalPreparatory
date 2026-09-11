import { useCallback, useEffect, useMemo, useState } from 'react'
import { Wallet } from 'lucide-react'
import { useAuth } from '@/auth/AuthContext'
import { PageHeader } from '@/components/dashboard/PageHeader'
import { Badge } from '@/components/dashboard/Badge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { SelectField, TextField } from '@/components/dashboard/Field'
import { TableSkeleton } from '@/components/dashboard/Loaders'
import { EmptyState, ErrorState } from '@/components/dashboard/States'
import { api } from '@/lib/api'
import { formatMoney } from '@/lib/money'
import { financeRoute } from './financeRoute'
import type { DailyFinanceStatus, DailyPupilFinanceRow, SchoolClassView } from '@/types/portal'

const financeStatusBadge: Record<DailyFinanceStatus, { label: string; tone: 'green' | 'red' | 'amber' | 'neutral' | 'blue' }> = {
  PAID: { label: 'Paid', tone: 'green' },
  PARTIALLY_PAID: { label: 'Partial', tone: 'amber' },
  NOT_PAID: { label: 'Not Paid', tone: 'red' },
  ABSENT: { label: 'Absent', tone: 'neutral' },
  EXEMPT: { label: 'Exempt', tone: 'blue' },
}

function todayISO() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function PupilFinancePage() {
  const { user } = useAuth()
  const base = financeRoute(user?.roles ?? [])

  const [date, setDate] = useState(todayISO)
  const [classId, setClassId] = useState('')
  const [q, setQ] = useState('')
  const [result, setResult] = useState<DailyPupilFinanceRow[]>([])
  const [meta, setMeta] = useState<{ sessionName: string; termName: string; dailyFeeAmount: string; paFeeAmount: string } | null>(null)
  const [classes, setClasses] = useState<SchoolClassView[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const loadClasses = useCallback(async () => {
    try {
      const all = await api.listClasses()
      setClasses(all.filter((c) => c.status === 'ACTIVE'))
    } catch {
      // non-critical — page still works without class filter
    }
  }, [])

  useEffect(() => {
    void loadClasses()
  }, [loadClasses])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await api.listDailyPupilFinance({ date, classId: classId || undefined, q: q.trim() || undefined })
      setResult(res.items)
      setMeta({ sessionName: res.sessionName, termName: res.termName, dailyFeeAmount: res.dailyFeeAmount, paFeeAmount: res.paFeeAmount })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load pupil finance data.')
    } finally {
      setLoading(false)
    }
  }, [date, classId, q])

  useEffect(() => {
    void load()
  }, [load])

  const stats = useMemo(() => {
    let paid = 0, partial = 0, notPaid = 0, absent = 0, exempt = 0
    for (const p of result) {
      if (p.financeStatus === 'PAID') paid++
      else if (p.financeStatus === 'PARTIALLY_PAID') partial++
      else if (p.financeStatus === 'NOT_PAID') notPaid++
      else if (p.financeStatus === 'ABSENT') absent++
      else exempt++
    }
    return { paid, partial, notPaid, absent, exempt }
  }, [result])

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Fees & Finance"
        title="Pupil Finance"
        description="Daily collection status — payments for today's school day across Daily Fee and PA Fee."
      />

      <Card className="p-4">
        <div className="flex flex-wrap items-end gap-4">
          <TextField
            label="Date"
            name="date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-44"
          />
          <SelectField
            label="Class"
            name="classId"
            value={classId}
            onChange={(e) => setClassId(e.target.value)}
            className="w-48"
            options={[
              { value: '', label: 'All classes' },
              ...classes.map((c) => ({ value: c.id, label: c.name })),
            ]}
          />
          <TextField
            label="Search"
            name="q"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Name or pupil ID"
            className="w-64"
          />
          <Button variant="soft" size="sm" onClick={() => void load()}>Refresh</Button>
        </div>
        {meta && (
          <p className="mt-2 text-xs text-ink-500">
            {meta.sessionName} · {meta.termName} · Daily fee: {formatMoney(meta.dailyFeeAmount)} · PA fee: {formatMoney(meta.paFeeAmount)}
          </p>
        )}
      </Card>

      {result.length > 0 && (
        <div className="flex flex-wrap gap-3 text-sm">
          <span className="text-ink-500">Total: {result.length}</span>
          <Badge tone="green">Paid: {stats.paid}</Badge>
          {stats.partial > 0 && <Badge tone="amber">Partial: {stats.partial}</Badge>}
          {stats.notPaid > 0 && <Badge tone="red">Not Paid: {stats.notPaid}</Badge>}
          <Badge tone="neutral">Absent: {stats.absent}</Badge>
          {stats.exempt > 0 && <Badge tone="blue">Exempt: {stats.exempt}</Badge>}
        </div>
      )}

      {error ? (
        <ErrorState message={error} onRetry={() => void load()} />
      ) : loading ? (
        <TableSkeleton rows={6} />
      ) : result.length === 0 ? (
        <EmptyState
          icon={<Wallet className="h-7 w-7" aria-hidden="true" />}
          title="No pupils found."
          description="Select a different date or class to see collection data."
        />
      ) : (
        <>
          <Card className="hidden overflow-hidden md:block">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-cream-200 bg-cream-50 text-xs font-bold uppercase tracking-wider text-ink-500">
                  <tr>
                    <th scope="col" className="px-5 py-3.5">Pupil</th>
                    <th scope="col" className="px-5 py-3.5">Class</th>
                    <th scope="col" className="px-5 py-3.5 text-right">Daily Paid</th>
                    <th scope="col" className="px-5 py-3.5 text-right">PA Paid</th>
                    <th scope="col" className="px-5 py-3.5 text-right">Outstanding</th>
                    <th scope="col" className="px-5 py-3.5">Status</th>
                    <th scope="col" className="px-5 py-3.5 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-cream-200">
                  {result.map((pupil) => {
                    const badge = financeStatusBadge[pupil.financeStatus]
                    return (
                      <tr key={pupil.id} className="transition-colors hover:bg-cream-50">
                        <td className="px-5 py-3.5">
                          <p className="font-bold text-ink-900">{pupil.fullName}</p>
                          <p className="text-xs text-ink-500">{pupil.pupilId}</p>
                        </td>
                        <td className="px-5 py-3.5 text-ink-700">{pupil.className}</td>
                        <td className="px-5 py-3.5 text-right font-semibold text-emerald-700">{formatMoney(pupil.dailyPaid)}</td>
                        <td className="px-5 py-3.5 text-right font-semibold text-emerald-700">{formatMoney(pupil.paPaid)}</td>
                        <td className="px-5 py-3.5 text-right">
                          <span className={Number(pupil.outstanding) > 0 ? 'font-bold text-red-700' : 'font-bold text-ink-900'}>
                            {formatMoney(pupil.outstanding)}
                          </span>
                        </td>
                        <td className="px-5 py-3.5"><Badge tone={badge.tone}>{badge.label}</Badge></td>
                        <td className="px-5 py-3.5">
                          <div className="flex justify-end">
                            <Button variant="soft" size="sm" to={`${base}/pupils/${pupil.id}`}>
                              View
                            </Button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Mobile list */}
          <ul className="space-y-3 md:hidden">
            {result.map((pupil) => {
              const badge = financeStatusBadge[pupil.financeStatus]
              return (
                <li key={pupil.id}>
                  <Card className="p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold text-ink-900">{pupil.fullName}</p>
                        <p className="text-xs text-ink-500">
                          {pupil.pupilId} · {pupil.className}
                        </p>
                      </div>
                      <Badge tone={badge.tone}>{badge.label}</Badge>
                    </div>
                    <div className="mt-3 flex items-center justify-between gap-3 border-t border-cream-200 pt-3">
                      <div className="text-sm">
                        <p className="text-ink-500">
                          Daily {formatMoney(pupil.dailyPaid)} · PA {formatMoney(pupil.paPaid)}
                        </p>
                        <p className="font-bold text-ink-900">
                          Outstanding{' '}
                          <span className={Number(pupil.outstanding) > 0 ? 'text-red-700' : ''}>
                            {formatMoney(pupil.outstanding)}
                          </span>
                        </p>
                      </div>
                      <Button variant="soft" size="sm" to={`${base}/pupils/${pupil.id}`}>
                        View
                      </Button>
                    </div>
                  </Card>
                </li>
              )
            })}
          </ul>
        </>
      )}
    </div>
  )
}
