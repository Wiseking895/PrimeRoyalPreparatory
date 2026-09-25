import { useCallback, useEffect, useState } from 'react'
import { ArrowLeft, BookOpenCheck, ChevronRight, Users } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import { useAuth } from '@/auth/AuthContext'
import { Card } from '@/components/ui/Card'
import { StatusBadge } from '@/components/dashboard/Badge'
import { Avatar } from '@/components/dashboard/Avatar'
import { ConfirmDialog } from '@/components/dashboard/ConfirmDialog'
import { CardSkeleton } from '@/components/dashboard/Loaders'
import { ErrorState, EmptyState } from '@/components/dashboard/States'
import { useToast } from '@/components/dashboard/Toast'
import { api } from '@/lib/api'
import type { TeacherView } from '@/types/portal'

export function TeacherProfilePage() {
  const { id } = useParams<{ id: string }>()
  const { hasPermission } = useAuth()
  const { push } = useToast()
  const [teacher, setTeacher] = useState<TeacherView | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [deactivateTarget, setDeactivateTarget] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const canManageAssignments = hasPermission('assignments.manage')

  const load = useCallback(async () => {
    if (!id) return
    setError(null)
    try {
      setTeacher(await api.getTeacher(id))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load the teacher profile.')
    }
  }, [id])

  useEffect(() => {
    void load()
  }, [load])

  const confirmDeactivate = async () => {
    if (!deactivateTarget) return
    setBusy(true)
    try {
      await api.deactivateTeachingAssignment(deactivateTarget)
      push('success', 'Teaching assignment removed.')
      setDeactivateTarget(null)
      await load()
    } catch (err) {
      push('error', err instanceof Error ? err.message : 'Could not remove the assignment.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-6 rounded-3xl bg-royal-900 p-5 sm:p-7 lg:p-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs font-semibold text-cream-200/70">
            <Link to="../" className="transition-colors hover:text-white">
              Teachers
            </Link>
            <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
            <span className="text-gold-300">Profile</span>
          </nav>
          <h1 className="mt-1.5 text-2xl font-extrabold tracking-tight text-white sm:text-3xl">
            {teacher?.fullName ?? 'Teacher'}
          </h1>
          <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-cream-200/75">
            {teacher ? `${teacher.positionLabel} · Staff ID ${teacher.staffId}.` : 'Loading…'}
          </p>
        </div>
        <Link
          to="../"
          className="inline-flex w-fit items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-white/20"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Back to teachers
        </Link>
      </div>

      {error ? (
        <ErrorState message={error} onRetry={() => void load()} />
      ) : teacher === null ? (
        <CardSkeleton />
      ) : (
        <>
          <Card className="p-6 sm:p-7">
            <div className="flex flex-wrap items-center gap-4">
              <Avatar name={teacher.fullName} size="xl" className="ring-4 ring-cream-200" />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-lg font-extrabold tracking-tight text-royal-800">{teacher.fullName}</h2>
                  <StatusBadge status={teacher.status} />
                </div>
                <p className="mt-1 text-sm text-ink-500">
                  {teacher.email} · {teacher.positionLabel} · {teacher.roleNames.join(', ') || 'No roles'}
                </p>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {teacher.roleNames.map((role) => (
                    <span
                      key={role}
                      className="rounded-full bg-gold-400/20 px-2.5 py-1 text-xs font-bold text-gold-700 ring-1 ring-inset ring-gold-500/30"
                    >
                      {role}
                    </span>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <MiniStat label="Assignments" value={teacher.assignmentCount} />
                <MiniStat label="Classes" value={teacher.classTeacherClassCount} />
                <MiniStat label="SBA records" value={teacher.sbaRecordCount} />
              </div>
            </div>
          </Card>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card className="p-6">
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-royal-500" aria-hidden="true" />
                <h2 className="text-sm font-bold uppercase tracking-wider text-royal-800">Classes as Class Teacher</h2>
              </div>
              {teacher.classesAsClassTeacher.length === 0 ? (
                <div className="mt-4">
                  <EmptyState title="Not a class teacher yet." />
                </div>
              ) : (
                <ul className="mt-4 space-y-3">
                  {teacher.classesAsClassTeacher.map((entry) => (
                    <li key={entry.classId} className="flex items-center justify-between rounded-xl bg-cream-50 px-4 py-3">
                      <span className="text-sm font-bold text-ink-900">{entry.className}</span>
                      <span className="text-xs text-ink-500">{entry.pupilCount} pupils</span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            <Card className="p-6">
              <div className="flex items-center gap-2">
                <BookOpenCheck className="h-5 w-5 text-magenta-500" aria-hidden="true" />
                <h2 className="text-sm font-bold uppercase tracking-wider text-royal-800">Teaching Assignments</h2>
              </div>
              {teacher.teachingAssignments.length === 0 ? (
                <div className="mt-4">
                  <EmptyState
                    title="No subject assignments yet."
                    description="Assign this teacher to subjects and classes to enable them to enter assessment scores."
                  />
                </div>
              ) : (
                <ul className="mt-4 space-y-3">
                  {teacher.teachingAssignments.map((assignment) => (
                    <li
                      key={assignment.id}
                      className="flex items-center justify-between gap-3 rounded-xl bg-cream-50 px-4 py-3"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold text-ink-900">
                          {assignment.subjectName} — {assignment.className}
                        </p>
                        <p className="truncate text-xs text-ink-500">
                          {assignment.pupilCount} pupils · {assignment.sbaEnteredCount} scores entered
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <StatusBadge status={assignment.status} />
                        {canManageAssignments && assignment.status === 'ACTIVE' ? (
                          <button
                            type="button"
                            onClick={() => setDeactivateTarget(assignment.id)}
                            className="rounded-full border border-cream-300 px-3 py-1.5 text-xs font-semibold text-red-600 transition-colors hover:bg-red-50"
                          >
                            Remove
                          </button>
                        ) : null}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>

          <ConfirmDialog
            open={deactivateTarget !== null}
            title="Remove teaching assignment?"
            message="This teacher will no longer be assigned to this subject and class. Existing assessment scores are preserved."
            confirmLabel="Remove assignment"
            loading={busy}
            onConfirm={() => void confirmDeactivate()}
            onCancel={() => setDeactivateTarget(null)}
          />
        </>
      )}
    </div>
  )
}

function MiniStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-cream-200 px-4 py-2 text-center">
      <p className="text-lg font-extrabold text-ink-900">{value}</p>
      <p className="text-xs text-ink-500">{label}</p>
    </div>
  )
}