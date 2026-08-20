import { useEffect, useState } from 'react'
import { FileText, Search } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/auth/AuthContext'
import { portalBasePath } from '@/auth/roles'
import { PageHeader } from '@/components/dashboard/PageHeader'
import { CardSkeleton } from '@/components/dashboard/Loaders'
import { EmptyState, ErrorState } from '@/components/dashboard/States'
import { api } from '@/lib/api'
import type { ReportPupilRow } from '@/types/portal'

export function ReportsPage() {
  const { user } = useAuth()
  const basePath = portalBasePath(user?.roles ?? [])

  const [pupils, setPupils] = useState<ReportPupilRow[] | null>(null)
  const [q, setQ] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    setLoading(true)
    setError(null)
    api
      .listReportPupils({ q: q.trim() || undefined })
      .then((result) => {
        if (active) setPupils(result.items)
      })
      .catch((err) => {
        if (active) setError(err instanceof Error ? err.message : 'Failed to load pupils.')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [q])

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Terminal Reports"
        title="Pupils"
        description="Select a pupil to view their terminal reports. Teachers only see pupils in their own classes."
      />

      <div className="relative max-w-md">
        <Search
          className="pointer-events-none absolute left-4 top-1/2 h-4.5 w-4.5 -translate-y-1/2 text-ink-500"
          aria-hidden="true"
        />
        <input
          type="search"
          value={q}
          onChange={(event) => setQ(event.target.value)}
          placeholder="Search by name or admission number…"
          className="h-12 w-full rounded-xl border border-cream-300 bg-white pl-11 pr-4 text-sm text-ink-900 outline-none transition-colors placeholder:text-ink-500/60 focus:border-magenta-500"
        />
      </div>

      {loading && !pupils ? (
        <CardSkeleton />
      ) : error ? (
        <ErrorState title="Could not load pupils" message={error} onRetry={() => setQ((value) => value)} />
      ) : pupils && pupils.length > 0 ? (
        <div className="overflow-hidden rounded-2xl border border-cream-300/70 bg-white shadow-[0_2px_16px_-8px_rgba(11,20,48,0.1)]">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-cream-200 bg-cream-50 text-[11px] uppercase tracking-wider text-ink-500">
                <th className="px-6 py-3 font-bold">Pupil</th>
                <th className="px-4 py-3 font-bold">Class</th>
                <th className="px-4 py-3 font-bold">Status</th>
                <th className="px-6 py-3 text-right font-bold">Reports</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-cream-100">
              {pupils.map((pupil) => (
                <tr key={pupil.id} className="transition-colors hover:bg-cream-50">
                  <td className="px-6 py-3 font-semibold text-ink-900">
                    {pupil.fullName}
                    <span className="ml-2 text-xs font-normal text-ink-400">{pupil.pupilId}</span>
                  </td>
                  <td className="px-4 py-3 text-ink-700">{pupil.className}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-bold ring-1 ring-inset ${
                        pupil.status === 'ACTIVE'
                          ? 'bg-emerald-100 text-emerald-700 ring-emerald-600/20'
                          : 'bg-cream-200 text-ink-500 ring-ink-500/20'
                      }`}
                    >
                      {pupil.status === 'ACTIVE' ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-6 py-3 text-right">
                    <Link
                      to={`${basePath}/reports/${pupil.id}`}
                      className="inline-flex items-center gap-1.5 rounded-full bg-royal-600 px-4 py-2 text-xs font-bold text-white transition-colors hover:bg-royal-700"
                    >
                      <FileText className="h-3.5 w-3.5" aria-hidden="true" />
                      View reports
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState
          title="No pupils found"
          description="Try a different search, or no pupils are in your report scope yet."
        />
      )}
    </div>
  )
}