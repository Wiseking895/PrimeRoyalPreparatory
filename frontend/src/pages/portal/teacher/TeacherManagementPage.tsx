import { useCallback, useEffect, useState } from 'react'
import { ArrowRight, Search, Users } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/auth/AuthContext'
import { PageHeader } from '@/components/dashboard/PageHeader'
import { Card } from '@/components/ui/Card'
import { StatusBadge } from '@/components/dashboard/Badge'
import { Avatar } from '@/components/dashboard/Avatar'
import { TableSkeleton } from '@/components/dashboard/Loaders'
import { ErrorState, EmptyState } from '@/components/dashboard/States'
import { SelectField, TextField } from '@/components/dashboard/Field'
import { api } from '@/lib/api'
import type { TeacherListRow } from '@/types/portal'

export function TeacherManagementPage() {
  const { hasPermission } = useAuth()
  const [teachers, setTeachers] = useState<TeacherListRow[] | null>(null)
  const [q, setQ] = useState('')
  const [status, setStatus] = useState<'ACTIVE' | 'INACTIVE' | ''>('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const canView = hasPermission('teachers.view')

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setTeachers(
        await api.listTeachers({
          q: q.trim() || undefined,
          status: status || undefined,
        }),
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load teachers.')
    } finally {
      setLoading(false)
    }
  }, [q, status])

  useEffect(() => {
    if (canView) void load()
  }, [load, canView])

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Academic"
        title="Teachers"
        description="Teaching staff eligible for class and subject assignments. Eligibility is enforced by the backend on staff position and status."
      />

      {!canView ? (
        <ErrorState title="Permission required" message="You do not have permission to view teachers." />
      ) : (
        <>
          <Card className="p-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <TextField
                label="Search"
                name="search"
                placeholder="Search by name, email or staff ID"
                value={q}
                onChange={(event) => setQ(event.target.value)}
              />
              <SelectField
                label="Status"
                name="status"
                placeholder="All statuses"
                value={status}
                onChange={(event) => setStatus(event.target.value as 'ACTIVE' | 'INACTIVE' | '')}
                options={[
                  { value: 'ACTIVE', label: 'Active' },
                  { value: 'INACTIVE', label: 'Inactive' },
                ]}
              />
            </div>
          </Card>

          {error ? (
            <ErrorState message={error} onRetry={() => void load()} />
          ) : loading || teachers === null ? (
            <TableSkeleton rows={6} />
          ) : teachers.length === 0 ? (
            <EmptyState
              icon={<Users className="h-7 w-7" aria-hidden="true" />}
              title="No teaching staff found."
              description="Staff holding a teaching position (class teacher, subject teacher or assistant headteacher) appear here."
            />
          ) : (
            <Card className="overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-cream-50 text-xs uppercase tracking-wider text-ink-500">
                    <tr>
                      <th scope="col" className="px-4 py-3 font-semibold">Teacher</th>
                      <th scope="col" className="px-4 py-3 font-semibold">Position</th>
                      <th scope="col" className="px-4 py-3 font-semibold">Assignments</th>
                      <th scope="col" className="px-4 py-3 font-semibold">Classes</th>
                      <th scope="col" className="px-4 py-3 font-semibold">SBA records</th>
                      <th scope="col" className="px-4 py-3 font-semibold">Status</th>
                      <th scope="col" className="px-4 py-3 font-semibold"><span className="sr-only">View</span></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-cream-100">
                    {teachers.map((teacher) => (
                      <tr key={teacher.id} className="hover:bg-cream-50/60">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <Avatar name={teacher.fullName} size="sm" />
                            <div className="min-w-0">
                              <p className="truncate font-bold text-ink-900">{teacher.fullName}</p>
                              <p className="truncate text-xs text-ink-500">{teacher.staffId}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <p className="font-semibold text-ink-700">{teacher.positionLabel}</p>
                          <p className="text-xs text-ink-500">{teacher.roleNames.join(', ') || 'No roles'}</p>
                        </td>
                        <td className="px-4 py-3 text-ink-700">{teacher.assignmentCount}</td>
                        <td className="px-4 py-3 text-ink-700">{teacher.classTeacherClassCount}</td>
                        <td className="px-4 py-3 text-ink-700">{teacher.sbaRecordCount}</td>
                        <td className="px-4 py-3">
                          <StatusBadge status={teacher.status} />
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Link
                            to={`${teacher.id}`}
                            className="inline-flex items-center gap-1 text-xs font-semibold text-magenta-600 hover:text-magenta-700"
                          >
                            View <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex items-center gap-1.5 border-t border-cream-200 px-4 py-3 text-xs font-medium text-ink-500">
                <Search className="h-3.5 w-3.5" aria-hidden="true" />
                {teachers.length} teacher(s)
              </div>
            </Card>
          )}
        </>
      )}
    </div>
  )
}