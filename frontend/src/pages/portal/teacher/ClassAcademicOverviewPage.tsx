import { useCallback, useEffect, useState } from 'react'
import { ArrowLeft, BookOpenCheck, GraduationCap, Users } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import { PageHeader } from '@/components/dashboard/PageHeader'
import { Card } from '@/components/ui/Card'
import { StatusBadge } from '@/components/dashboard/Badge'
import { CardSkeleton, TableSkeleton } from '@/components/dashboard/Loaders'
import { ErrorState, EmptyState } from '@/components/dashboard/States'
import { api } from '@/lib/api'
import type { ClassTeacherView, PupilView, SchoolClassView, TeacherAssignmentView } from '@/types/portal'

export function ClassAcademicOverviewPage() {
  const { classId } = useParams<{ classId: string }>()
  const [klass, setKlass] = useState<SchoolClassView | null>(null)
  const [classTeacher, setClassTeacher] = useState<ClassTeacherView | null>(null)
  const [assignments, setAssignments] = useState<TeacherAssignmentView[] | null>(null)
  const [pupils, setPupils] = useState<PupilView[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!classId) return
    setLoading(true)
    setError(null)
    try {
      const [classData, teacherData, assignmentData, pupilData] = await Promise.all([
        api.getClass(classId),
        api.getClassTeacher(classId),
        api.listTeachingAssignments({ classId }),
        api.listPupils({ classId, pageSize: 500 }),
      ])
      setKlass(classData)
      setClassTeacher(teacherData)
      setAssignments(assignmentData)
      setPupils(pupilData.items)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load the class overview.')
    } finally {
      setLoading(false)
    }
  }, [classId])

  useEffect(() => {
    void load()
  }, [load])

  if (loading || klass === null) {
    return (
      <div className="space-y-6">
        <PageHeader eyebrow="Academic" title="Class overview" />
        <CardSkeleton />
        <TableSkeleton rows={5} />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Academic"
        title={klass.name}
        description={`Class key ${klass.key} · ${pupils.length} pupil(s) · academic overview`}
        actions={
          <Link
            to="../classes"
            className="inline-flex items-center gap-2 rounded-full border border-cream-300 bg-white px-4 py-2 text-sm font-semibold text-ink-700 transition-colors hover:bg-cream-100"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Back to classes
          </Link>
        }
      />

      {error ? (
        <ErrorState message={error} onRetry={() => void load()} />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-2xl border border-cream-300/70 bg-white p-5">
              <p className="text-xs font-semibold uppercase tracking-wider text-ink-500">Class Teacher</p>
              <p className="mt-2 text-lg font-bold text-ink-900">{classTeacher?.teacherName ?? 'Not assigned'}</p>
              <p className="mt-0.5 text-xs text-ink-500">Assigned in charge of this class</p>
            </div>
            <div className="rounded-2xl border border-cream-300/70 bg-white p-5">
              <p className="text-xs font-semibold uppercase tracking-wider text-ink-500">Subject Assignments</p>
              <p className="mt-2 text-lg font-bold text-ink-900">{assignments?.length ?? 0}</p>
              <p className="mt-0.5 text-xs text-ink-500">Teachers assigned to subjects in this class</p>
            </div>
            <div className="rounded-2xl border border-cream-300/70 bg-white p-5">
              <p className="text-xs font-semibold uppercase tracking-wider text-ink-500">Status</p>
              <div className="mt-2"><StatusBadge status={klass.status} /></div>
              <p className="mt-2 text-xs text-ink-500">Class status</p>
            </div>
          </div>

          <Card className="p-6">
            <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-ink-500">
              <BookOpenCheck className="h-4 w-4 text-royal-500" aria-hidden="true" />
              Subjects Taught in This Class
            </h2>
            {assignments === null ? (
              <div className="mt-4"><TableSkeleton rows={4} /></div>
            ) : assignments.length === 0 ? (
              <div className="mt-4">
                <EmptyState
                  title="No subject assignments for this class."
                  description="Assign teachers to subjects in this class to begin recording assessments."
                />
              </div>
            ) : (
              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-cream-50 text-xs uppercase tracking-wider text-ink-500">
                    <tr>
                      <th scope="col" className="px-4 py-3 font-semibold">Subject</th>
                      <th scope="col" className="px-4 py-3 font-semibold">Teacher</th>
                      <th scope="col" className="px-4 py-3 font-semibold">Pupils</th>
                      <th scope="col" className="px-4 py-3 font-semibold">SBA entered</th>
                      <th scope="col" className="px-4 py-3 font-semibold">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-cream-100">
                    {assignments.map((assignment) => (
                      <tr key={assignment.id} className="hover:bg-cream-50/60">
                        <td className="px-4 py-3 font-semibold text-ink-900">
                          {assignment.subjectName} <span className="text-xs font-medium text-ink-500">({assignment.subjectCode})</span>
                        </td>
                        <td className="px-4 py-3 text-ink-700">{assignment.teacherId ? 'Assigned' : '—'}</td>
                        <td className="px-4 py-3 text-ink-700">{assignment.pupilCount}</td>
                        <td className="px-4 py-3 text-ink-700">{assignment.sbaEnteredCount}</td>
                        <td className="px-4 py-3"><StatusBadge status={assignment.status} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          <Card className="p-6">
            <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-ink-500">
              <GraduationCap className="h-4 w-4 text-magenta-500" aria-hidden="true" />
              Pupils in This Class
            </h2>
            {pupils.length === 0 ? (
              <div className="mt-4">
                <EmptyState title="No pupils enrolled in this class yet." />
              </div>
            ) : (
              <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {pupils.map((pupil) => (
                  <li key={pupil.id} className="flex items-center gap-3 rounded-xl bg-cream-50 px-4 py-3">
                    <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-royal-600/10 text-royal-600">
                      <Users className="h-4 w-4" aria-hidden="true" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold text-ink-900">{pupil.fullName}</p>
                      <p className="truncate text-xs text-ink-500">{pupil.pupilId}</p>
                    </div>
                    <StatusBadge status={pupil.status} />
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </>
      )}
    </div>
  )
}