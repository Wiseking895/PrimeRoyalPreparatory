import { useEffect, useState } from 'react'
import { ArrowLeft } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import { PageHeader } from '@/components/dashboard/PageHeader'
import { CardSkeleton } from '@/components/dashboard/Loaders'
import { ErrorState } from '@/components/dashboard/States'
import { ReportSheet } from '@/components/dashboard/ReportSheet'
import { api } from '@/lib/api'
import type { TerminalReportView } from '@/types/portal'

export function ParentReportViewPage() {
  const { pupilId = '', termId = '' } = useParams<{ pupilId: string; termId: string }>()
  const [report, setReport] = useState<TerminalReportView | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    setLoading(true)
    setError(null)
    api
      .getMyChildReport(pupilId, termId)
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
  }, [pupilId, termId])

  if (loading) {
    return <CardSkeleton />
  }

  if (error || !report) {
    return <ErrorState title="Cannot open this report" message={error ?? ''} onRetry={() => window.location.reload()} />
  }

  return (
    <div className="space-y-6">
      <Link
        to={`/parent/children/${pupilId}`}
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-royal-600 transition-colors hover:text-magenta-600"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Back to child
      </Link>

      <PageHeader
        eyebrow="Terminal Report"
        title={`${report.term.name} — ${report.session.name}`}
        description={`${report.pupil.fullName} · ${report.pupil.pupilId}`}
      />

      <ReportSheet report={report} onPrint={() => window.print()} />
    </div>
  )
}