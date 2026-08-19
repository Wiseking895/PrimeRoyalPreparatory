import { useCallback, useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { BookOpenCheck, GraduationCap, Pencil, Plus, Users } from 'lucide-react'
import { OWNER_ROLE } from '@/auth/roles'
import { useAuth } from '@/auth/AuthContext'
import { PageHeader } from '@/components/dashboard/PageHeader'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { StatusBadge } from '@/components/dashboard/Badge'
import { ConfirmDialog } from '@/components/dashboard/ConfirmDialog'
import { Modal } from '@/components/dashboard/Modal'
import { TextField, TextAreaField } from '@/components/dashboard/Field'
import { Spinner, CardSkeleton, TableSkeleton } from '@/components/dashboard/Loaders'
import { EmptyState, ErrorState } from '@/components/dashboard/States'
import { StatCard } from '@/components/dashboard/StatCard'
import { useToast } from '@/components/dashboard/Toast'
import { api } from '@/lib/api'
import type { ClassCreateInput, SchoolClassView } from '@/types/portal'

interface ClassForm {
  key: string
  name: string
  description: string
  sortOrder: string
}

const emptyForm: ClassForm = { key: '', name: '', description: '', sortOrder: '' }

export function ClassManagementPage() {
  const { push } = useToast()
  const { user, hasPermission } = useAuth()

  const basePath = user?.roles.includes(OWNER_ROLE) ? '/owner' : '/headteacher'

  const [classes, setClasses] = useState<SchoolClassView[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<SchoolClassView | null>(null)
  const [form, setForm] = useState<ClassForm>(emptyForm)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)

  const [confirmStatus, setConfirmStatus] = useState<{ class: SchoolClassView; status: 'ACTIVE' | 'INACTIVE' } | null>(null)
  const [busyAction, setBusyAction] = useState<string | null>(null)

  const can = {
    manage: hasPermission('classes.manage'),
  }

  const load = useCallback(async () => {
    setError(null)
    try {
      setClasses(await api.listClasses())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load classes.')
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const openCreate = () => {
    setEditing(null)
    setForm(emptyForm)
    setFieldErrors({})
    setModalOpen(true)
  }

  const openEdit = (klass: SchoolClassView) => {
    setEditing(klass)
    setForm({
      key: klass.key,
      name: klass.name,
      description: klass.description ?? '',
      sortOrder: String(klass.sortOrder),
    })
    setFieldErrors({})
    setModalOpen(true)
  }

  const set = (field: keyof ClassForm, value: string) => {
    setForm((current) => ({ ...current, [field]: value }))
    setFieldErrors((current) => {
      if (!current[field]) return current
      const next = { ...current }
      delete next[field]
      return next
    })
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const errors: Record<string, string> = {}
    if (!/^[A-Z0-9_]+$/.test(form.key.trim()))
      errors.key = 'Use only uppercase letters, numbers and underscores.'
    if (form.name.trim().length < 1) errors.name = 'Class name is required.'
    if (form.sortOrder !== '' && !/^\d+$/.test(form.sortOrder))
      errors.sortOrder = 'Sort order must be a whole number.'
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors)
      return
    }

    const payload: ClassCreateInput = {
      key: form.key.trim(),
      name: form.name.trim(),
      description: form.description.trim() || undefined,
      sortOrder: form.sortOrder === '' ? undefined : Number(form.sortOrder),
    }

    setSubmitting(true)
    try {
      if (editing) {
        const updated = await api.updateClass(editing.id, payload)
        setClasses((current) =>
          (current ?? []).map((entry) => (entry.id === updated.id ? updated : entry)),
        )
        push('success', `${updated.name} updated.`)
      } else {
        const created = await api.createClass(payload)
        setClasses((current) => (current ? [...current, created] : [created]))
        push('success', `${created.name} created.`)
      }
      setModalOpen(false)
    } catch (err) {
      const apiError = err as { fieldErrors?: Record<string, string> }
      if (apiError.fieldErrors && Object.keys(apiError.fieldErrors).length > 0) {
        setFieldErrors(apiError.fieldErrors)
      } else {
        push('error', err instanceof Error ? err.message : 'Could not save the class.')
      }
    } finally {
      setSubmitting(false)
    }
  }

  const handleToggleStatus = async () => {
    if (!confirmStatus) return
    const { class: klass, status } = confirmStatus
    setBusyAction('status')
    try {
      const updated = await api.setClassStatus(klass.id, status)
      setClasses((current) => (current ?? []).map((entry) => (entry.id === updated.id ? updated : entry)))
      push('success', status === 'ACTIVE' ? `${updated.name} activated.` : `${updated.name} deactivated.`)
    } catch (err) {
      push('error', err instanceof Error ? err.message : 'Could not update the class.')
    } finally {
      setBusyAction(null)
      setConfirmStatus(null)
    }
  }

  const totalPupils = classes?.reduce((sum, klass) => sum + klass.pupilCount, 0) ?? 0
  const activePupils = classes?.reduce((sum, klass) => sum + klass.activePupilCount, 0) ?? 0
  const activeClasses = classes?.filter((klass) => klass.status === 'ACTIVE').length ?? 0

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Class Management"
        title="Classes"
        description="Class levels used across the school. Pupils are grouped into these classes and class teachers manage their rosters."
        actions={
          can.manage ? (
            <Button onClick={openCreate}>
              <Plus className="h-4 w-4" aria-hidden="true" />
              Add Class
            </Button>
          ) : undefined
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {classes ? (
          <>
            <StatCard
              label="Total Classes"
              value={classes.length}
              hint={`${activeClasses} active`}
              icon={<GraduationCap className="h-5 w-5" aria-hidden="true" />}
              tone="royal"
            />
            <StatCard
              label="Active Classes"
              value={activeClasses}
              hint="Accepting pupil placements"
              icon={<BookOpenCheck className="h-5 w-5" aria-hidden="true" />}
              tone="magenta"
            />
            <StatCard
              label="Total Pupils"
              value={totalPupils}
              hint="Across all classes"
              icon={<Users className="h-5 w-5" aria-hidden="true" />}
              tone="gold"
            />
            <StatCard
              label="Active Pupils"
              value={activePupils}
              hint={totalPupils - activePupils > 0 ? `${totalPupils - activePupils} inactive` : 'All pupils active'}
              icon={<BookOpenCheck className="h-5 w-5" aria-hidden="true" />}
              tone="green"
            />
          </>
        ) : (
          Array.from({ length: 4 }).map((_, index) => <CardSkeleton key={index} />)
        )}
      </div>

      {error ? (
        <ErrorState message={error} onRetry={() => void load()} />
      ) : classes === null ? (
        <TableSkeleton rows={6} />
      ) : classes.length === 0 ? (
        <EmptyState
          icon={<GraduationCap className="h-7 w-7" aria-hidden="true" />}
          title="No classes have been created yet."
          description="Add a class level to begin grouping pupils."
          action={
            can.manage ? (
              <Button onClick={openCreate}>
                <Plus className="h-4 w-4" aria-hidden="true" />
                Add Class
              </Button>
            ) : undefined
          }
        />
      ) : (
        <Card className="hidden overflow-hidden md:block">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-cream-200 bg-cream-50 text-xs font-bold uppercase tracking-wider text-ink-500">
                <tr>
                  <th scope="col" className="px-5 py-3.5">Class</th>
                  <th scope="col" className="px-5 py-3.5">Key</th>
                  <th scope="col" className="px-5 py-3.5">Pupils</th>
                  <th scope="col" className="px-5 py-3.5">Status</th>
                  <th scope="col" className="px-5 py-3.5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-cream-200">
                {classes.map((klass) => (
                  <tr key={klass.id} className="transition-colors hover:bg-cream-50">
                    <td className="px-5 py-3.5">
                      <p className="font-bold text-ink-900">{klass.name}</p>
                      {klass.description ? (
                        <p className="truncate text-xs text-ink-500">{klass.description}</p>
                      ) : null}
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="rounded-full bg-royal-600/10 px-2.5 py-1 text-xs font-semibold text-royal-700">
                        {klass.key}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-ink-700">
                      {klass.pupilCount}
                      <span className="text-xs text-ink-500"> ({klass.activePupilCount} active)</span>
                    </td>
                    <td className="px-5 py-3.5"><StatusBadge status={klass.status} /></td>
                    <td className="px-5 py-3.5">
                      <div className="flex justify-end gap-2">
                        <Button variant="soft" size="sm" to={`${basePath}/pupils?classId=${klass.id}`}>
                          View pupils
                        </Button>
                        {can.manage ? (
                          <Button variant="soft" size="sm" onClick={() => openEdit(klass)}>
                            <Pencil className="h-4 w-4" aria-hidden="true" />
                            Edit
                          </Button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Mobile cards */}
      {classes && classes.length > 0 ? (
        <ul className="space-y-3 md:hidden">
          {classes.map((klass) => (
            <li key={klass.id}>
              <Card className="p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-ink-900">{klass.name}</p>
                    <p className="text-xs text-ink-500">
                      {klass.key} · {klass.pupilCount} pupils
                    </p>
                  </div>
                  <StatusBadge status={klass.status} />
                </div>
                {klass.description ? (
                  <p className="mt-2 text-xs leading-relaxed text-ink-500">{klass.description}</p>
                ) : null}
                <div className="mt-3 flex flex-wrap justify-end gap-2 border-t border-cream-200 pt-3">
                  <Button variant="soft" size="sm" to={`${basePath}/pupils?classId=${klass.id}`}>
                    View pupils
                  </Button>
                  {can.manage ? (
                    <Button variant="soft" size="sm" onClick={() => openEdit(klass)}>
                      <Pencil className="h-4 w-4" aria-hidden="true" />
                      Edit
                    </Button>
                  ) : null}
                  {can.manage ? (
                    <Button
                      variant="soft"
                      size="sm"
                      onClick={() =>
                        setConfirmStatus({
                          class: klass,
                          status: klass.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE',
                        })
                      }
                    >
                      {klass.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}
                    </Button>
                  ) : null}
                </div>
              </Card>
            </li>
          ))}
        </ul>
      ) : null}

      {/* Create / edit dialog */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Edit class' : 'Add class'}
        description={
          editing
            ? `Update the details of ${editing.name}.`
            : 'Create a class level that pupils will be grouped into.'
        }
        size="lg"
      >
        <form onSubmit={handleSubmit} noValidate className="grid gap-4 sm:grid-cols-2">
          <TextField
            label="Class key"
            name="key"
            value={form.key}
            onChange={(event) => set('key', event.target.value)}
            error={fieldErrors.key}
            hint="Uppercase code, e.g. PRIMARY_1."
            required
            autoComplete="off"
          />
          <TextField
            label="Class name"
            name="name"
            value={form.name}
            onChange={(event) => set('name', event.target.value)}
            error={fieldErrors.name}
            hint="Display name, e.g. Primary 1."
            required
            autoComplete="off"
          />
          <div className="sm:col-span-2">
            <TextAreaField
              label="Description"
              name="description"
              value={form.description}
              onChange={(event) => set('description', event.target.value)}
              error={fieldErrors.description}
            />
          </div>
          <div className="sm:col-span-2">
            <TextField
              label="Sort order"
              name="sortOrder"
              inputMode="numeric"
              value={form.sortOrder}
              onChange={(event) => set('sortOrder', event.target.value)}
              error={fieldErrors.sortOrder}
              hint="Lower numbers appear first. Defaults to 0."
            />
          </div>
          <div className="flex items-center justify-end gap-2 sm:col-span-2">
            <Button variant="cream" type="button" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? <Spinner className="h-4 w-4" /> : null}
              {editing ? 'Save changes' : 'Create class'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Status confirm */}
      {confirmStatus ? (
        <ConfirmDialog
          open
          title={confirmStatus.status === 'ACTIVE' ? 'Activate class' : 'Deactivate class'}
          message={
            confirmStatus.status === 'ACTIVE'
              ? `Activating ${confirmStatus.class.name} makes it available for new pupil placements. Existing pupils are unaffected.`
              : `Deactivating ${confirmStatus.class.name} prevents new placements in this class. Existing pupil records are not removed.`
          }
          confirmLabel={confirmStatus.status === 'ACTIVE' ? 'Activate' : 'Deactivate'}
          loading={busyAction === 'status'}
          onConfirm={() => void handleToggleStatus()}
          onCancel={() => setConfirmStatus(null)}
        />
      ) : null}
    </div>
  )
}