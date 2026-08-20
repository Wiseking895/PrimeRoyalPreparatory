import { useCallback, useEffect, useState } from 'react'
import { GraduationCap, Plus, Trash2, UserCog } from 'lucide-react'
import { useAuth } from '@/auth/AuthContext'
import { PageHeader } from '@/components/dashboard/PageHeader'
import { Card } from '@/components/ui/Card'
import { StatusBadge } from '@/components/dashboard/Badge'
import { ConfirmDialog } from '@/components/dashboard/ConfirmDialog'
import { TableSkeleton } from '@/components/dashboard/Loaders'
import { ErrorState, EmptyState } from '@/components/dashboard/States'
import { SelectField } from '@/components/dashboard/Field'
import { useToast } from '@/components/dashboard/Toast'
import { api } from '@/lib/api'
import type { ClassTeacherView, SchoolClassView, SubjectView, TeacherAssignmentView, TeacherListRow } from '@/types/portal'

export function TeacherAssignmentPage() {
  const { hasPermission } = useAuth()
  const { push } = useToast()
  const [teachers, setTeachers] = useState<TeacherListRow[]>([])
  const [subjects, setSubjects] = useState<SubjectView[]>([])
  const [classes, setClasses] = useState<SchoolClassView[]>([])
  const [assignments, setAssignments] = useState<TeacherAssignmentView[] | null>(null)
  const [classTeachers, setClassTeachers] = useState<Record<string, ClassTeacherView | null>>({})
  const [form, setForm] = useState({ teacherId: '', subjectId: '', classId: '' })
  const [classTeacherSelections, setClassTeacherSelections] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [deactivateTarget, setDeactivateTarget] = useState<string | null>(null)

  const canManage = hasPermission('assignments.manage')

  const load = useCallback(async () => {
    setError(null)
    try {
      const [teacherData, subjectData, classData, assignmentData] = await Promise.all([
        api.listTeachers(),
        api.listSubjects({ status: 'ACTIVE' }),
        api.listClasses(),
        api.listTeachingAssignments(),
      ])
      setTeachers(teacherData.filter((teacher) => teacher.status === 'ACTIVE'))
      setSubjects(subjectData.filter((subject) => subject.status === 'ACTIVE'))
      setClasses(classData.filter((entry) => entry.status === 'ACTIVE'))
      setAssignments(assignmentData)

      const currentClassTeachers: Record<string, ClassTeacherView | null> = {}
      const classTeacherResults = await Promise.all(
        classData.map(async (entry) => {
          try {
            return [entry.id, await api.getClassTeacher(entry.id)] as const
          } catch {
            return [entry.id, null] as const
          }
        }),
      )
      for (const [classId, teacher] of classTeacherResults) {
        currentClassTeachers[classId] = teacher
      }
      setClassTeachers(currentClassTeachers)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load assignment data.')
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const handleCreate = async () => {
    if (!form.teacherId || !form.subjectId || !form.classId) {
      push('error', 'Select a teacher, subject and class.')
      return
    }
    setBusy(true)
    try {
      await api.assignTeachingAssignment(form)
      push('success', 'Teacher assigned.')
      setForm({ teacherId: '', subjectId: '', classId: '' })
      await load()
    } catch (err) {
      push('error', err instanceof Error ? err.message : 'Could not create the assignment.')
    } finally {
      setBusy(false)
    }
  }

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

  const handleClassTeacher = async (classId: string) => {
    const teacherId = classTeacherSelections[classId]
    if (!teacherId) {
      push('error', 'Select a teacher to assign.')
      return
    }
    setBusy(true)
    try {
      await api.assignClassTeacher(classId, teacherId)
      push('success', 'Class teacher assigned.')
      await load()
    } catch (err) {
      push('error', err instanceof Error ? err.message : 'Could not assign the class teacher.')
    } finally {
      setBusy(false)
    }
  }

  const handleRemoveClassTeacher = async (classId: string, teacherName: string) => {
    setBusy(true)
    try {
      await api.removeClassTeacher(classId)
      push('success', `Removed ${teacherName} as class teacher.`)
      await load()
    } catch (err) {
      push('error', err instanceof Error ? err.message : 'Could not remove the class teacher.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Academic"
        title="Teacher Assignments"
        description="Assign teaching staff to subjects and classes, and set class teachers. Only active staff holding a teaching position may be assigned."
      />

      {error ? (
        <ErrorState message={error} onRetry={() => void load()} />
      ) : (
        <>
          {canManage ? (
            <Card className="p-6">
              <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-ink-500">
                <Plus className="h-4 w-4 text-magenta-500" aria-hidden="true" />
                New teaching assignment
              </h2>
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <SelectField
                  label="Teacher"
                  name="teacher"
                  placeholder="Select a teacher"
                  value={form.teacherId}
                  onChange={(event) => setForm((current) => ({ ...current, teacherId: event.target.value }))}
                  options={teachers.map((teacher) => ({ value: teacher.id, label: `${teacher.fullName} (${teacher.positionLabel})` }))}
                />
                <SelectField
                  label="Subject"
                  name="subject"
                  placeholder="Select a subject"
                  value={form.subjectId}
                  onChange={(event) => setForm((current) => ({ ...current, subjectId: event.target.value }))}
                  options={subjects.map((subject) => ({ value: subject.id, label: `${subject.name} (${subject.code})` }))}
                />
                <SelectField
                  label="Class"
                  name="class"
                  placeholder="Select a class"
                  value={form.classId}
                  onChange={(event) => setForm((current) => ({ ...current, classId: event.target.value }))}
                  options={classes.map((entry) => ({ value: entry.id, label: entry.name }))}
                />
              </div>
              <div className="mt-4 flex justify-end">
                <button
                  type="button"
                  onClick={() => void handleCreate()}
                  disabled={busy}
                  className="rounded-full bg-magenta-500 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-magenta-600 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {busy ? 'Working…' : 'Assign teacher'}
                </button>
              </div>
            </Card>
          ) : null}

          <Card className="overflow-hidden">
            <div className="border-b border-cream-200 px-6 py-4">
              <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-ink-500">
                <GraduationCap className="h-4 w-4 text-royal-500" aria-hidden="true" />
                Teaching assignments
              </h2>
            </div>
            {assignments === null ? (
              <div className="p-6">
                <TableSkeleton rows={5} />
              </div>
            ) : assignments.length === 0 ? (
              <div className="p-6">
                <EmptyState
                  title="No teaching assignments yet."
                  description={canManage ? 'Use the form above to assign a teacher to a subject and class.' : 'Assignments will appear here once created.'}
                />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-cream-50 text-xs uppercase tracking-wider text-ink-500">
                    <tr>
                      <th scope="col" className="px-4 py-3 font-semibold">Teacher</th>
                      <th scope="col" className="px-4 py-3 font-semibold">Subject</th>
                      <th scope="col" className="px-4 py-3 font-semibold">Class</th>
                      <th scope="col" className="px-4 py-3 font-semibold">Pupils</th>
                      <th scope="col" className="px-4 py-3 font-semibold">SBA entered</th>
                      <th scope="col" className="px-4 py-3 font-semibold">Status</th>
                      <th scope="col" className="px-4 py-3 font-semibold"><span className="sr-only">Actions</span></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-cream-100">
                    {assignments.map((assignment) => (
                      <tr key={assignment.id} className="hover:bg-cream-50/60">
                        <td className="px-4 py-3 font-semibold text-ink-900">
                          {teachers.find((teacher) => teacher.id === assignment.teacherId)?.fullName ?? 'Teacher'}
                        </td>
                        <td className="px-4 py-3 text-ink-700">
                          {assignment.subjectName} <span className="text-xs text-ink-500">({assignment.subjectCode})</span>
                        </td>
                        <td className="px-4 py-3 text-ink-700">{assignment.className}</td>
                        <td className="px-4 py-3 text-ink-700">{assignment.pupilCount}</td>
                        <td className="px-4 py-3 text-ink-700">{assignment.sbaEnteredCount}</td>
                        <td className="px-4 py-3">
                          <StatusBadge status={assignment.status} />
                        </td>
                        <td className="px-4 py-3 text-right">
                          {canManage && assignment.status === 'ACTIVE' ? (
                            <button
                              type="button"
                              onClick={() => setDeactivateTarget(assignment.id)}
                              className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-ink-500 transition-colors hover:bg-red-50 hover:text-red-600"
                              aria-label={`Remove assignment for ${assignment.className}`}
                            >
                              <Trash2 className="h-4 w-4" aria-hidden="true" />
                            </button>
                          ) : null}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          {canManage ? (
            <Card className="p-6">
              <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-ink-500">
                <UserCog className="h-4 w-4 text-gold-500" aria-hidden="true" />
                Class teacher assignment
              </h2>
              <div className="mt-4 space-y-3">
                {classes.length === 0 ? (
                  <EmptyState title="No active classes found." />
                ) : (
                  classes.map((entry) => {
                    const current = classTeachers[entry.id]
                    const selection = classTeacherSelections[entry.id] ?? current?.teacherId ?? ''
                    return (
                      <div
                        key={entry.id}
                        className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-cream-200 px-4 py-3"
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-ink-900">{entry.name}</p>
                          <p className="text-xs text-ink-500">
                            {current ? `Current class teacher: ${current.teacherName}` : 'No class teacher assigned'}
                          </p>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          <SelectField
                            label="Teacher"
                            name={`class-teacher-${entry.id}`}
                            value={selection}
                            onChange={(event) =>
                              setClassTeacherSelections((currentSelections) => ({
                                ...currentSelections,
                                [entry.id]: event.target.value,
                              }))
                            }
                            options={teachers.map((teacher) => ({ value: teacher.id, label: teacher.fullName }))}
                            className="min-w-52 py-2"
                          />
                          <button
                            type="button"
                            onClick={() => void handleClassTeacher(entry.id)}
                            disabled={busy}
                            className="rounded-full bg-royal-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-royal-700 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            Assign
                          </button>
                          {current ? (
                            <button
                              type="button"
                              onClick={() => void handleRemoveClassTeacher(entry.id, current.teacherName)}
                              disabled={busy}
                              className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-cream-300 text-ink-500 transition-colors hover:bg-red-50 hover:text-red-600"
                              aria-label={`Remove class teacher for ${entry.name}`}
                            >
                              <Trash2 className="h-4 w-4" aria-hidden="true" />
                            </button>
                          ) : null}
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            </Card>
          ) : null}
        </>
      )}

      <ConfirmDialog
        open={deactivateTarget !== null}
        title="Remove teaching assignment?"
        message="This teacher will no longer teach this subject in this class. Existing assessment scores are preserved."
        confirmLabel="Remove assignment"
        loading={busy}
        onConfirm={() => void confirmDeactivate()}
        onCancel={() => setDeactivateTarget(null)}
      />
    </div>
  )
}