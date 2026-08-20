import { useCallback, useEffect, useState } from 'react'
import { ClipboardList, Filter, Search } from 'lucide-react'
import { PageHeader } from '@/components/dashboard/PageHeader'
import { Card } from '@/components/ui/Card'
import { StatusBadge } from '@/components/dashboard/Badge'
import { TableSkeleton } from '@/components/dashboard/Loaders'
import { ErrorState, EmptyState } from '@/components/dashboard/States'
import { SelectField } from '@/components/dashboard/Field'
import { api } from '@/lib/api'
import { formatDate } from '@/lib/date'
import type { AcademicSessionView, AcademicTermView, SchoolClassView, SbaRecordView, SubjectView } from '@/types/portal'

export function SbaRecordsPage() {
  const [records, setRecords] = useState<SbaRecordView[] | null>(null)
  const [sessions, setSessions] = useState<AcademicSessionView[]>([])
  const [terms, setTerms] = useState<AcademicTermView[]>([])
  const [classes, setClasses] = useState<SchoolClassView[]>([])
  const [subjects, setSubjects] = useState<SubjectView[]>([])
  const [sessionId, setSessionId] = useState('')
  const [termId, setTermId] = useState('')
  const [classId, setClassId] = useState('')
  const [subjectId, setSubjectId] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const loadOptions = useCallback(async () => {
    try {
      const [sessionData, classData, subjectData] = await Promise.all([
        api.listSessions(),
        api.listClasses(),
        api.listSubjects({ status: 'ACTIVE' }),
      ])
      setSessions(sessionData)
      setClasses(classData)
      setSubjects(subjectData)
      const activeSession = sessionData.find((session) => session.status === 'ACTIVE') ?? sessionData[0]
      setSessionId(activeSession?.id ?? '')
    } catch {
      // Option loading failures are surfaced when the records request runs.
    }
  }, [])

  const loadRecords = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await api.listSba({
        sessionId: sessionId || undefined,
        termId: termId || undefined,
        classId: classId || undefined,
        subjectId: subjectId || undefined,
      })
      setRecords(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load SBA records.')
    } finally {
      setLoading(false)
    }
  }, [sessionId, termId, classId, subjectId])

  useEffect(() => {
    void loadOptions()
  }, [loadOptions])

  useEffect(() => {
    if (sessionId) {
      void api.listTerms(sessionId).then(setTerms).catch(() => setTerms([]))
    } else {
      setTerms([])
    }
  }, [sessionId])

  useEffect(() => {
    void loadRecords()
  }, [loadRecords])

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Assessment Records"
        title="SBA Records"
        description="School-based assessment scores recorded across classes, subjects and terms."
      />

      <Card className="p-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <SelectField
            label="Session"
            name="session"
            placeholder="All sessions"
            value={sessionId}
            onChange={(event) => {
              setSessionId(event.target.value)
              setTermId('')
            }}
            options={sessions.map((session) => ({ value: session.id, label: session.name }))}
          />
          <SelectField
            label="Term"
            name="term"
            placeholder="All terms"
            value={termId}
            onChange={(event) => setTermId(event.target.value)}
            options={terms.map((term) => ({ value: term.id, label: term.name }))}
          />
          <SelectField
            label="Class"
            name="class"
            placeholder="All classes"
            value={classId}
            onChange={(event) => setClassId(event.target.value)}
            options={classes.map((entry) => ({ value: entry.id, label: entry.name }))}
          />
          <SelectField
            label="Subject"
            name="subject"
            placeholder="All subjects"
            value={subjectId}
            onChange={(event) => setSubjectId(event.target.value)}
            options={subjects.map((entry) => ({ value: entry.id, label: `${entry.name} (${entry.code})` }))}
          />
        </div>
        <p className="mt-3 flex items-center gap-1.5 text-xs text-ink-500">
          <Filter className="h-3.5 w-3.5" aria-hidden="true" />
          Results are limited to records you are permitted to view.
        </p>
      </Card>

      {error ? (
        <ErrorState message={error} onRetry={() => void loadRecords()} />
      ) : loading || records === null ? (
        <TableSkeleton rows={6} />
      ) : records.length === 0 ? (
        <EmptyState
          icon={<Search className="h-7 w-7" aria-hidden="true" />}
          title="No SBA records match."
          description="Try widening your filters, or enter scores for one of your classes."
        />
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-cream-50 text-xs uppercase tracking-wider text-ink-500">
                <tr>
                  <th scope="col" className="px-4 py-3 font-semibold">Pupil</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Class</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Subject</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Term</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Score</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Teacher</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Updated</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-cream-100">
                {records.map((record) => (
                  <tr key={record.id} className="hover:bg-cream-50/60">
                    <td className="px-4 py-3">
                      <p className="font-bold text-ink-900">{record.pupilName}</p>
                      <p className="text-xs text-ink-500">{record.pupilCode}</p>
                    </td>
                    <td className="px-4 py-3 text-ink-700">{record.className}</td>
                    <td className="px-4 py-3 text-ink-700">
                      {record.subjectName} <span className="text-xs text-ink-500">({record.subjectCode})</span>
                    </td>
                    <td className="px-4 py-3 text-ink-700">{record.termName}</td>
                    <td className="px-4 py-3">
                      <span className="font-bold text-ink-900">{record.score}</span>
                      <span className="text-xs text-ink-500">/{record.maxScore}</span>
                    </td>
                    <td className="px-4 py-3 text-ink-700">{record.teacherName}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <StatusBadge status={record.pupilStatus === 'ACTIVE' ? 'ACTIVE' : 'INACTIVE'} />
                        <span className="text-xs text-ink-500">{formatDate(record.updatedAt)}</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between border-t border-cream-200 px-4 py-3">
            <p className="flex items-center gap-1.5 text-xs font-medium text-ink-500">
              <ClipboardList className="h-3.5 w-3.5" aria-hidden="true" />
              {records.length} record(s)
            </p>
          </div>
        </Card>
      )}
    </div>
  )
}