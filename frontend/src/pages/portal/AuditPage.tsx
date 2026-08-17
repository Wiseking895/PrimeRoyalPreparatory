import { useCallback, useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight, ScrollText } from 'lucide-react'
import { PageHeader } from '@/components/dashboard/PageHeader'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/dashboard/Badge'
import { TableSkeleton } from '@/components/dashboard/Loaders'
import { EmptyState, ErrorState } from '@/components/dashboard/States'
import { api } from '@/lib/api'
import type { AuditEntry } from '@/types/portal'
import { formatDate } from '@/lib/date'

const PAGE_SIZE = 25

function actionTone(action: string): 'green' | 'red' | 'amber' | 'royal' | 'magenta' | 'neutral' {
  if (action.includes('delete') || action.includes('deactivate')) return 'red'
  if (action.includes('create') || action.includes('activate')) return 'green'
  if (action.includes('login') || action.includes('password')) return 'amber'
  if (action.includes('permissions')) return 'magenta'
  return 'royal'
}

export function AuditPage() {
  const [entries, setEntries] = useState<AuditEntry[] | null>(null)
  const [total, setTotal] = useState(0)
  const [offset, setOffset] = useState(0)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async (pageOffset: number) => {
    setError(null)
    setEntries(null)
    try {
      const page = await api.listAudit(PAGE_SIZE, pageOffset)
      setEntries(page.entries)
      setTotal(page.total)
      setOffset(page.offset)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load the audit log.')
    }
  }, [])

  useEffect(() => {
    void load(0)
  }, [load])

  const page = Math.floor(offset / PAGE_SIZE)
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Security"
        title="Audit Activity"
        description="A chronological, read-only record of administrative actions taken across the school platform."
      />

      {error ? (
        <ErrorState message={error} onRetry={() => void load(offset)} />
      ) : entries === null ? (
        <TableSkeleton rows={8} />
      ) : entries.length === 0 ? (
        <EmptyState
          icon={<ScrollText className="h-7 w-7" aria-hidden="true" />}
          title="No audit activity yet."
          description="Sign-ins, account changes and permission updates will appear here."
        />
      ) : (
        <>
          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-cream-200 bg-cream-50 text-xs font-bold uppercase tracking-wider text-ink-500">
                  <tr>
                    <th scope="col" className="px-5 py-3.5">Actor</th>
                    <th scope="col" className="px-5 py-3.5">Action</th>
                    <th scope="col" className="px-5 py-3.5">Resource</th>
                    <th scope="col" className="px-5 py-3.5">IP</th>
                    <th scope="col" className="px-5 py-3.5">When</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-cream-200">
                  {entries.map((entry) => (
                    <tr key={entry.id} className="transition-colors hover:bg-cream-50">
                      <td className="px-5 py-3.5">
                        <p className="font-bold text-ink-900">{entry.actor?.fullName ?? 'System'}</p>
                        {entry.actor ? <p className="text-xs text-ink-500">{entry.actor.email}</p> : null}
                      </td>
                      <td className="px-5 py-3.5">
                        <Badge tone={actionTone(entry.action)}>{entry.action}</Badge>
                      </td>
                      <td className="px-5 py-3.5 text-ink-700">
                        <span className="block">{entry.resourceType ?? '—'}</span>
                        {entry.resourceId ? (
                          <span className="block truncate text-xs text-ink-500">{entry.resourceId}</span>
                        ) : null}
                      </td>
                      <td className="px-5 py-3.5 text-ink-500">{entry.ip ?? '—'}</td>
                      <td className="px-5 py-3.5 text-ink-500">{formatDate(entry.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <div className="flex items-center justify-between">
            <p className="text-sm text-ink-500">
              Page {page + 1} of {pageCount} · {total} entr{total === 1 ? 'y' : 'ies'}
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => void load(offset - PAGE_SIZE)}
                disabled={offset === 0}
                className="inline-flex items-center gap-1.5 rounded-full border border-cream-300 bg-white px-4 py-2 text-sm font-semibold text-ink-700 transition-colors hover:border-magenta-500 hover:text-magenta-600 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                Previous
              </button>
              <button
                type="button"
                onClick={() => void load(offset + PAGE_SIZE)}
                disabled={offset + PAGE_SIZE >= total}
                className="inline-flex items-center gap-1.5 rounded-full border border-cream-300 bg-white px-4 py-2 text-sm font-semibold text-ink-700 transition-colors hover:border-magenta-500 hover:text-magenta-600 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Next
                <ChevronRight className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
