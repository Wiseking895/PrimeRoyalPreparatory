import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, FileText } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import { useAuth } from '@/auth/AuthContext'
import { portalBasePath } from '@/auth/roles'
import { PageHeader } from '@/components/dashboard/PageHeader'
import { CardSkeleton } from '@/components/dashboard/Loaders'
import { EmptyState, ErrorState } from '@/components/dashboard/States'
import { ReportSheet } from '@/components/dashboard/ReportSheet'
import { cn } from '@/lib/cn'
import { api } from '@/lib/api'
import type { ReportTermOption, TerminalReportView } from '@/types/portal'

export function ReportViewPage() {
  const { pupilId = '' } = useParams<{ pupilId: string }>()
  const { user } = useAuth()
  const basePath = portalBasePath(user?.roles ?? [])

  const [terms, setTerms] = useState<ReportTermOption[] | null>(null)
  const [selectedTermId, setSelectedTermId] = useState<string | null>(null)
  const [report, setReport] = useState<TerminalReportView | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    setLoading(true)
    setError(null)
    api
      .listPupilReports(pupilId)
      .then((result) => {
        if (!active) return
        setTerms(result)
        const firstAvailable = result.find((term) => term.hasReport)
        if (firstAvailable) setSelectedTermId(firstAvailable.id)
      })
      .catch((err) => {
        if (active) setError(err instanceof Error ? err.message : 'Failed to load the report options.')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [pupilId])

  useEffect(() => {
    if (!selectedTermId) {
      setReport(null)
      return
    }
    let active = true
    setLoading(true)
    api
      .getPupilReport(pupilId, selectedTermId)
      .then((result) => {
        if (active) setReport(result)
      })
      .catch((err) => {
        if (active) setError(err instanceof Error ? err.message : 'Failed to load this report.')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [pupilId, selectedTermId])

  const reportTerm = useMemo(
    () => terms?.find((term) => term.id === selectedTermId) ?? null,
    [terms, selectedTermId],
  )

  if (error && !report) {
    return <ErrorState title="Cannot open this report" message={error} onRetry={() => window.location.reload()} />
  }

  return (
    <div className="space-y-6">
      <Link
        to={`${basePath}/reports`}
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-royal-600 transition-colors hover:text-magenta-600"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        All pupils
      </Link>

      <PageHeader
        eyebrow="Terminal Report"
        title={report?.pupil.fullName ?? 'Pupil report'}
        description={report ? `${report.pupil.pupilId} · ${report.pupil.className}` : undefined}
      />

      {terms === null && !error ? (
        <CardSkeleton />
      ) : terms && terms.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {terms.map((term) => (
            <button
              key={term.id}
              type="button"
              onClick={() => setSelectedTermId(term.id)}
              disabled={!term.hasReport}
              className={cn(
                'inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition-colors',
                term.id === selectedTermId
                  ? 'border-royal-600 bg-royal-600 text-white'
                  : term.hasReport
                    ? 'border-cream-300 bg-white text-ink-700 hover:border-royal-400'
                    : 'cursor-not-allowed border-cream-200 bg-cream-50 text-ink-400',
              )}
            >
              <FileText className="h-4 w-4" aria-hidden="true" />
              {term.name}
              <span className="text-xs opacity-80">{term.sessionName}</span>
            </button>
          ))}
        </div>
      ) : (
        <EmptyState
          title="No reports available"
          description="No academic terms have been set up, or no reports have been recorded for this pupil."
        />
      )}

      {report ? (
        <div>
          {reportTerm && !reportTerm.hasReport ? (
            <p className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-3.5 text-sm text-amber-800">
              No School-Based Assessment records have been recorded for this term yet.
            </p>
          ) : null}
          <ReportSheet report={report} onPrint={() => window.print()} />
        </div>
      ) : loading ? (
        <CardSkeleton />
      ) : null}
    </div>
  )
}