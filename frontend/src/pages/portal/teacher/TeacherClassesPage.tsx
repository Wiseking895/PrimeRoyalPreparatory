import { useCallback, useEffect, useState } from 'react'
import { ClipboardList, GraduationCap, Users } from 'lucide-react'
import { Link } from 'react-router-dom'
import { PageHeader } from '@/components/dashboard/PageHeader'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/dashboard/Badge'
import { CardSkeleton } from '@/components/dashboard/Loaders'
import { ErrorState, EmptyState } from '@/components/dashboard/States'
import { api } from '@/lib/api'
import type { TeacherAssignmentView, TeacherPortalView } from '@/types/portal'

export function TeacherClassesPage() {
  const [portal, setPortal] = useState<TeacherPortalView | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setError(null)
    try {
      setPortal(await api.academicMe())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load your classes.')
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const classCounts = new Map<string, number>()
  for (const assignment of portal?.teachingAssignments ?? []) {
    classCounts.set(assignment.classId, (classCounts.get(assignment.classId) ?? 0) + 1)
  }

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="My Classes"
        title="Classes & Subjects"
        description="The classes you manage as a class teacher and the subjects you teach in each class."
      />

      {error ? (
        <ErrorState message={error} onRetry={() => void load()} />
      ) : portal === null ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <CardSkeleton key={index} />
          ))}
        </div>
      ) : (
        <>
          <Card className="p-6">
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-royal-500" aria-hidden="true" />
              <h2 className="text-sm font-bold uppercase tracking-wider text-ink-500">Classes I Manage</h2>
            </div>
            {portal.classesAsClassTeacher.length === 0 ? (
              <div className="mt-4">
                <EmptyState
                  title="You are not a class teacher yet."
                  description="Once the school assigns you a class to manage, its overview will appear here."
                />
              </div>
            ) : (
              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {portal.classesAsClassTeacher.map((entry) => (
                  <div key={entry.classId} className="rounded-xl border border-cream-200 bg-cream-50 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wider text-ink-500">Class</p>
                    <p className="mt-1 text-lg font-bold text-ink-900">{entry.className}</p>
                    <p className="mt-0.5 text-xs text-ink-500">{entry.pupilCount} pupil(s) · class teacher</p>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card className="p-6">
            <div className="flex items-center gap-2">
              <GraduationCap className="h-5 w-5 text-magenta-500" aria-hidden="true" />
              <h2 className="text-sm font-bold uppercase tracking-wider text-ink-500">Subjects I Teach</h2>
            </div>
            {portal.teachingAssignments.length === 0 ? (
              <div className="mt-4">
                <EmptyState
                  title="No subject assignments yet."
                  description="Your teaching assignments will appear here once the school assigns you subjects and classes."
                />
              </div>
            ) : (
              <div className="mt-4 space-y-4">
                {[...classCounts.entries()].map(([classId, subjectCount]) => {
                  const assignment = portal.teachingAssignments.find((entry) => entry.classId === classId)
                  if (!assignment) return null
                  return (
                    <div key={classId} className="rounded-xl border border-cream-200 p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-sm font-bold text-ink-900">{assignment.className}</p>
                        <Badge tone="royal">
                          {subjectCount} subject{subjectCount === 1 ? '' : 's'}
                        </Badge>
                      </div>
                      <ul className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                        {portal.teachingAssignments
                          .filter((entry) => entry.classId === classId)
                          .map((entry) => (
                            <AssignmentRow key={entry.id} assignment={entry} />
                          ))}
                      </ul>
                    </div>
                  )
                })}
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  )
}

function AssignmentRow({ assignment }: { assignment: TeacherAssignmentView }) {
  return (
    <li className="flex items-center justify-between gap-3 rounded-xl bg-cream-50 px-4 py-3">
      <div className="min-w-0">
        <p className="truncate text-sm font-bold text-ink-900">
          {assignment.subjectName} <span className="font-medium text-ink-500">({assignment.subjectCode})</span>
        </p>
        <p className="truncate text-xs text-ink-500">
          {assignment.pupilCount} pupils · {assignment.sbaEnteredCount} scores entered
        </p>
      </div>
      <Link
        to="/teacher/sba/entry"
        className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-magenta-600 hover:text-magenta-700"
      >
        <ClipboardList className="h-3.5 w-3.5" aria-hidden="true" />
        Enter scores
      </Link>
    </li>
  )
}