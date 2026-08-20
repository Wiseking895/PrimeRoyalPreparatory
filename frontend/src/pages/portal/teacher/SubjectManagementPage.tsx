import { useCallback, useEffect, useState } from 'react'
import { BookOpenCheck, Pencil, Plus, Power, Search } from 'lucide-react'
import { useAuth } from '@/auth/AuthContext'
import { PageHeader } from '@/components/dashboard/PageHeader'
import { Card } from '@/components/ui/Card'
import { StatusBadge } from '@/components/dashboard/Badge'
import { Modal } from '@/components/dashboard/Modal'
import { ConfirmDialog } from '@/components/dashboard/ConfirmDialog'
import { TableSkeleton } from '@/components/dashboard/Loaders'
import { ErrorState, EmptyState } from '@/components/dashboard/States'
import { SelectField, TextAreaField, TextField } from '@/components/dashboard/Field'
import { useToast } from '@/components/dashboard/Toast'
import { api } from '@/lib/api'
import type { SubjectCreateInput, SubjectUpdateInput, SubjectView } from '@/types/portal'

interface SubjectForm {
  code: string
  name: string
  description: string
  status: 'ACTIVE' | 'INACTIVE'
}

const EMPTY_FORM: SubjectForm = { code: '', name: '', description: '', status: 'ACTIVE' }

export function SubjectManagementPage() {
  const { hasPermission } = useAuth()
  const { push } = useToast()
  const [subjects, setSubjects] = useState<SubjectView[] | null>(null)
  const [q, setQ] = useState('')
  const [status, setStatus] = useState<'ACTIVE' | 'INACTIVE' | ''>('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<SubjectView | null>(null)
  const [form, setForm] = useState<SubjectForm>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [toggleTarget, setToggleTarget] = useState<SubjectView | null>(null)
  const [toggling, setToggling] = useState(false)

  const canManage = hasPermission('subjects.manage')

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setSubjects(
        await api.listSubjects({
          q: q.trim() || undefined,
          status: status || undefined,
        }),
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load subjects.')
    } finally {
      setLoading(false)
    }
  }, [q, status])

  useEffect(() => {
    void load()
  }, [load])

  const openCreate = () => {
    setEditing(null)
    setForm(EMPTY_FORM)
    setModalOpen(true)
  }

  const openEdit = (subject: SubjectView) => {
    setEditing(subject)
    setForm({
      code: subject.code,
      name: subject.name,
      description: subject.description ?? '',
      status: subject.status,
    })
    setModalOpen(true)
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      if (editing) {
        const input: SubjectUpdateInput = {
          code: form.code || undefined,
          name: form.name || undefined,
          description: form.description || null,
          status: form.status,
        }
        await api.updateSubject(editing.id, input)
        push('success', 'Subject updated.')
      } else {
        const input: SubjectCreateInput = {
          code: form.code,
          name: form.name,
          description: form.description || undefined,
          status: form.status,
        }
        await api.createSubject(input)
        push('success', 'Subject created.')
      }
      setModalOpen(false)
      await load()
    } catch (err) {
      push('error', err instanceof Error ? err.message : 'Could not save the subject.')
    } finally {
      setSaving(false)
    }
  }

  const confirmToggle = async () => {
    if (!toggleTarget) return
    setToggling(true)
    try {
      const next = toggleTarget.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE'
      await api.setSubjectStatus(toggleTarget.id, next)
      push('success', `Subject ${next === 'ACTIVE' ? 'activated' : 'deactivated'}.`)
      setToggleTarget(null)
      await load()
    } catch (err) {
      push('error', err instanceof Error ? err.message : 'Could not update the subject.')
    } finally {
      setToggling(false)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Academic"
        title="Subjects"
        description="The subjects taught across the school and their availability for teaching assignments."
        actions={
          canManage ? (
            <button
              type="button"
              onClick={openCreate}
              className="inline-flex items-center gap-2 rounded-full bg-magenta-500 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-magenta-600"
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              New subject
            </button>
          ) : null
        }
      />

      <Card className="p-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <TextField
            label="Search"
            name="search"
            placeholder="Search by code or name"
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
      ) : loading || subjects === null ? (
        <TableSkeleton rows={6} />
      ) : subjects.length === 0 ? (
        <EmptyState
          icon={<BookOpenCheck className="h-7 w-7" aria-hidden="true" />}
          title="No subjects found."
          description={canManage ? 'Create your first subject to start assigning teachers.' : 'Subjects will appear here once created.'}
        />
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-cream-50 text-xs uppercase tracking-wider text-ink-500">
                <tr>
                  <th scope="col" className="px-4 py-3 font-semibold">Code</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Subject</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Assignments</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Status</th>
                  <th scope="col" className="px-4 py-3 font-semibold"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-cream-100">
                {subjects.map((subject) => (
                  <tr key={subject.id} className="hover:bg-cream-50/60">
                    <td className="px-4 py-3 font-bold text-royal-700">{subject.code}</td>
                    <td className="px-4 py-3">
                      <p className="font-semibold text-ink-900">{subject.name}</p>
                      {subject.description ? <p className="text-xs text-ink-500">{subject.description}</p> : null}
                    </td>
                    <td className="px-4 py-3 text-ink-700">{subject.assignmentCount}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={subject.status} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1.5">
                        {canManage ? (
                          <>
                            <button
                              type="button"
                              onClick={() => openEdit(subject)}
                              className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-ink-500 transition-colors hover:bg-cream-100 hover:text-ink-900"
                              aria-label={`Edit ${subject.name}`}
                            >
                              <Pencil className="h-4 w-4" aria-hidden="true" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setToggleTarget(subject)}
                              className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-ink-500 transition-colors hover:bg-cream-100 hover:text-red-600"
                              aria-label={subject.status === 'ACTIVE' ? `Deactivate ${subject.name}` : `Activate ${subject.name}`}
                            >
                              <Power className="h-4 w-4" aria-hidden="true" />
                            </button>
                          </>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center gap-1.5 border-t border-cream-200 px-4 py-3 text-xs font-medium text-ink-500">
            <Search className="h-3.5 w-3.5" aria-hidden="true" />
            {subjects.length} subject(s)
          </div>
        </Card>
      )}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? `Edit ${editing.name}` : 'New subject'}
        description="Codes are stored in uppercase and must be unique."
      >
        <div className="space-y-4">
          <TextField
            label="Code"
            name="code"
            required
            placeholder="e.g. MATH"
            maxLength={20}
            value={form.code}
            onChange={(event) => setForm((current) => ({ ...current, code: event.target.value }))}
          />
          <TextField
            label="Name"
            name="name"
            required
            placeholder="e.g. Mathematics"
            maxLength={120}
            value={form.name}
            onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
          />
          <TextAreaField
            label="Description"
            name="description"
            maxLength={300}
            value={form.description}
            onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
          />
          <SelectField
            label="Status"
            name="status"
            value={form.status}
            onChange={(event) => setForm((current) => ({ ...current, status: event.target.value as 'ACTIVE' | 'INACTIVE' }))}
            options={[
              { value: 'ACTIVE', label: 'Active' },
              { value: 'INACTIVE', label: 'Inactive' },
            ]}
          />
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setModalOpen(false)}
              className="rounded-full px-5 py-2.5 text-sm font-semibold text-ink-700 transition-colors hover:bg-cream-100"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void handleSave()}
              disabled={saving || !form.code.trim() || !form.name.trim()}
              className="rounded-full bg-magenta-500 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-magenta-600 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? 'Saving…' : editing ? 'Save changes' : 'Create subject'}
            </button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={toggleTarget !== null}
        title={toggleTarget?.status === 'ACTIVE' ? 'Deactivate subject?' : 'Activate subject?'}
        message={`This will ${toggleTarget?.status === 'ACTIVE' ? 'stop new assignments to' : 'make available'} ${toggleTarget?.name ?? 'this subject'}. Existing assignments and assessment records are preserved.`}
        confirmLabel={toggleTarget?.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}
        loading={toggling}
        onConfirm={() => void confirmToggle()}
        onCancel={() => setToggleTarget(null)}
      />
    </div>
  )
}