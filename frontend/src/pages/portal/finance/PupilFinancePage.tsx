import { useCallback, useEffect, useState } from 'react'
import { Eye, Wallet } from 'lucide-react'
import { useAuth } from '@/auth/AuthContext'
import { PageHeader } from '@/components/dashboard/PageHeader'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { StatusBadge } from '@/components/dashboard/Badge'
import { TextField } from '@/components/dashboard/Field'
import { TableSkeleton } from '@/components/dashboard/Loaders'
import { EmptyState, ErrorState } from '@/components/dashboard/States'
import { api } from '@/lib/api'
import { formatMoney } from '@/lib/money'
import { financeRoute } from './financeRoute'
import type { FinancePupilListResult } from '@/types/portal'

export function PupilFinancePage() {
  const { user } = useAuth()
  const base = financeRoute(user?.roles ?? [])

  const [result, setResult] = useState<FinancePupilListResult | null>(null)
  const [q, setQ] = useState('')
  const [page, setPage] = useState(1)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setError(null)
    try {
      setResult(await api.listFinancePupils({ q: q.trim() || undefined, page, pageSize: 20 }))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load pupil finance records.')
    }
  }, [q, page])

  useEffect(() => {
    void load()
  }, [load])

  const totalPages = result ? Math.max(1, Math.ceil(result.total / result.pageSize)) : 1

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Fees & Finance"
        title="Pupil Finance"
        description="Balances for every pupil — total due, paid and outstanding across active fee charges."
      />

      <TextField
        label="Search pupils"
        name="q"
        value={q}
        onChange={(event) => {
          setQ(event.target.value)
          setPage(1)
        }}
        placeholder="Name or pupil ID"
        className="sm:w-80"
      />

      {error ? (
        <ErrorState message={error} onRetry={() => void load()} />
      ) : result === null ? (
        <TableSkeleton rows={6} />
      ) : result.items.length === 0 ? (
        <EmptyState
          icon={<Wallet className="h-7 w-7" aria-hidden="true" />}
          title="No pupils found."
          description="Search by name or pupil ID to see a pupil’s finance profile."
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
                    <th scope="col" className="px-5 py-3.5">Charges</th>
                    <th scope="col" className="px-5 py-3.5">Total due</th>
                    <th scope="col" className="px-5 py-3.5">Total paid</th>
                    <th scope="col" className="px-5 py-3.5">Outstanding</th>
                    <th scope="col" className="px-5 py-3.5">Status</th>
                    <th scope="col" className="px-5 py-3.5 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-cream-200">
                  {result.items.map((pupil) => (
                    <tr key={pupil.id} className="transition-colors hover:bg-cream-50">
                      <td className="px-5 py-3.5">
                        <p className="font-bold text-ink-900">{pupil.fullName}</p>
                        <p className="text-xs text-ink-500">{pupil.pupilId}</p>
                      </td>
                      <td className="px-5 py-3.5 text-ink-700">{pupil.className}</td>
                      <td className="px-5 py-3.5 text-ink-700">{pupil.chargeCount}</td>
                      <td className="px-5 py-3.5 text-ink-700">{formatMoney(pupil.totalDue)}</td>
                      <td className="px-5 py-3.5 font-semibold text-emerald-700">{formatMoney(pupil.totalPaid)}</td>
                      <td className="px-5 py-3.5">
                        <span
                          className={
                            Number(pupil.outstanding) > 0
                              ? 'font-bold text-red-700'
                              : 'font-bold text-ink-900'
                          }
                        >
                          {formatMoney(pupil.outstanding)}
                        </span>
                      </td>
                      <td className="px-5 py-3.5"><StatusBadge status={pupil.status} /></td>
                      <td className="px-5 py-3.5">
                        <div className="flex justify-end">
                          <Button variant="soft" size="sm" to={`${base}/pupils/${pupil.id}`}>
                            <Eye className="h-4 w-4" aria-hidden="true" />
                            View profile
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Mobile list */}
          <ul className="space-y-3 md:hidden">
            {result.items.map((pupil) => (
              <li key={pupil.id}>
                <Card className="p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-ink-900">{pupil.fullName}</p>
                      <p className="text-xs text-ink-500">
                        {pupil.pupilId} · {pupil.className}
                      </p>
                    </div>
                    <StatusBadge status={pupil.status} />
                  </div>
                  <div className="mt-3 flex items-center justify-between gap-3 border-t border-cream-200 pt-3">
                    <div className="text-sm">
                      <p className="text-ink-500">
                        Due {formatMoney(pupil.totalDue)} · Paid {formatMoney(pupil.totalPaid)}
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
            ))}
          </ul>

          {/* Pagination */}
          <div className="flex items-center justify-between">
            <p className="text-sm text-ink-500">
              {result.total} pupil(s) · page {result.page} of {totalPages}
            </p>
            <div className="flex gap-2">
              <Button variant="soft" size="sm" disabled={page <= 1} onClick={() => setPage((current) => current - 1)}>
                Previous
              </Button>
              <Button
                variant="soft"
                size="sm"
                disabled={!result.hasMore}
                onClick={() => setPage((current) => current + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}