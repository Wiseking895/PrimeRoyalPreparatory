import { useCallback, useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Pencil, Plus, Receipt, Users, Trash2 } from 'lucide-react'
import { useAuth } from '@/auth/AuthContext'
import { PageHeader } from '@/components/dashboard/PageHeader'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { StatusBadge, Badge } from '@/components/dashboard/Badge'
import { ConfirmDialog } from '@/components/dashboard/ConfirmDialog'
import { Modal } from '@/components/dashboard/Modal'
import { TextField, SelectField, TextAreaField } from '@/components/dashboard/Field'
import { Spinner, CardSkeleton, TableSkeleton } from '@/components/dashboard/Loaders'
import { EmptyState, ErrorState } from '@/components/dashboard/States'
import { StatCard } from '@/components/dashboard/StatCard'
import { useToast } from '@/components/dashboard/Toast'
import { api } from '@/lib/api'
import { formatMoney, isValidMoney } from '@/lib/money'
import { financeRoute } from './financeRoute'
import type { AccountStatusValue, AcademicSessionView, AcademicTermView, FeeTypeValue, FeeView } from '@/types/portal'

interface FeeRow {
  id: string
  name: string
  feeType: FeeTypeValue | ''
  amount: string
  description: string
}

let rowIdCounter = 0
function newRow(): FeeRow {
  return { id: `new-${++rowIdCounter}`, name: '', feeType: '', amount: '', description: '' }
}

interface EditForm {
  sessionId: string
  termId: string
  name: string
  feeType: FeeTypeValue | ''
  amount: string
  description: string
}

const emptyEditForm: EditForm = { sessionId: '', termId: '', name: '', feeType: '', amount: '', description: '' }

const feeTypeOptions: Array<{ value: FeeTypeValue; label: string }> = [
  { value: 'TERMLY', label: 'Termly' },
  { value: 'DAILY', label: 'Daily' },
  { value: 'PA', label: 'PA Fees' },
  { value: 'OTHER', label: 'Other' },
]

export function FeeStructuresPage() {
  const { push } = useToast()
  const { user, hasPermission } = useAuth()
  const base = financeRoute(user?.roles ?? [])

  const canManage = hasPermission('fees.manage')

  const [fees, setFees] = useState<FeeView[] | null>(null)
  const [sessions, setSessions] = useState<AcademicSessionView[]>([])
  const [terms, setTerms] = useState<AcademicTermView[]>([])
  const [sessionFilter, setSessionFilter] = useState<string>('')
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [error, setError] = useState<string | null>(null)

  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [editing, setEditing] = useState<FeeView | null>(null)

  const [createSessionId, setCreateSessionId] = useState('')
  const [createTermId, setCreateTermId] = useState('')
  const [feeRows, setFeeRows] = useState<FeeRow[]>([newRow()])
  const [createErrors, setCreateErrors] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)

  const [editForm, setEditForm] = useState<EditForm>(emptyEditForm)
  const [editFieldErrors, setEditFieldErrors] = useState<Record<string, string>>({})

  const [confirmStatus, setConfirmStatus] = useState<{ fee: FeeView; status: AccountStatusValue } | null>(null)
  const [busyAction, setBusyAction] = useState<string | null>(null)

  const load = useCallback(async () => {
    setError(null)
    try {
      const [feeData, sessionData] = await Promise.all([api.listFees(), api.listSessions()])
      setFees(feeData)
      setSessions(sessionData)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load fee structures.')
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const createSessionOptions = sessions.map((s) => ({ value: s.id, label: s.name }))
  const createTermOptions = terms.map((t) => ({ value: t.id, label: t.name }))

  useEffect(() => {
    if (!createSessionId) { setTerms([]); return }
    api.listTerms(createSessionId).then(setTerms).catch(() => setTerms([]))
  }, [createSessionId])

  const visibleFees = (fees ?? []).filter((fee) => {
    if (sessionFilter && fee.sessionId !== sessionFilter) return false
    if (statusFilter && fee.status !== statusFilter) return false
    return true
  })

  const openCreate = () => {
    const activeSessionId = sessions.find((s) => s.status === 'ACTIVE')?.id ?? ''
    setCreateSessionId(activeSessionId)
    setCreateTermId('')
    setFeeRows([newRow()])
    setCreateErrors({})
    setCreateModalOpen(true)
  }

  const openEdit = (fee: FeeView) => {
    setEditing(fee)
    setEditForm({
      sessionId: fee.sessionId,
      termId: fee.termId,
      name: fee.name,
      feeType: fee.feeType,
      amount: fee.amount,
      description: fee.description ?? '',
    })
    setEditFieldErrors({})
    setEditModalOpen(true)
  }

  const updateRow = (rowId: string, field: keyof FeeRow, value: string) => {
    setFeeRows((current) => current.map((row) => (row.id === rowId ? { ...row, [field]: value } : row)))
    const errorKey = `row_${rowId}_${field}`
    setCreateErrors((current) => {
      if (!current[errorKey]) return current
      const next = { ...current }
      delete next[errorKey]
      return next
    })
  }

  const addRow = () => {
    setFeeRows((current) => [...current, newRow()])
  }

  const removeRow = (rowId: string) => {
    setFeeRows((current) => {
      if (current.length <= 1) return current
      return current.filter((row) => row.id !== rowId)
    })
  }

  const handleCreateSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const errors: Record<string, string> = {}

    if (!createSessionId) errors.sessionId = 'Select a session.'
    if (!createTermId) errors.termId = 'Select a term.'

    for (const row of feeRows) {
      if (row.name.trim().length < 2) errors[`row_${row.id}_name`] = 'Fee name must be at least 2 characters.'
      if (!row.feeType) errors[`row_${row.id}_feeType`] = 'Select a fee type.'
      if (!isValidMoney(row.amount)) errors[`row_${row.id}_amount`] = 'Enter a valid amount with up to 2 decimal places.'
    }

    if (Object.keys(errors).length > 0) {
      setCreateErrors(errors)
      return
    }

    setSubmitting(true)
    try {
      const created = await api.createFeesBatch({
        sessionId: createSessionId,
        termId: createTermId,
        fees: feeRows.map((row) => ({
          name: row.name.trim(),
          feeType: row.feeType as FeeTypeValue,
          amount: row.amount.trim(),
          description: row.description.trim() || undefined,
        })),
      })
      setFees((current) => (current ? [...current, ...created] : created))
      push('success', `${created.length} fee structure${created.length > 1 ? 's' : ''} created.`)
      setCreateModalOpen(false)
    } catch (err) {
      const apiError = err as { fieldErrors?: Record<string, string> }
      if (apiError.fieldErrors && Object.keys(apiError.fieldErrors).length > 0) {
        setCreateErrors(apiError.fieldErrors)
      } else {
        push('error', err instanceof Error ? err.message : 'Could not save fee structures.')
      }
    } finally {
      setSubmitting(false)
    }
  }

  const handleEditSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!editing) return

    const errors: Record<string, string> = {}
    if (editForm.name.trim().length < 2) errors.name = 'Fee name must be at least 2 characters.'
    if (!editForm.feeType) errors.feeType = 'Select a fee type.'
    if (!isValidMoney(editForm.amount)) errors.amount = 'Enter a valid amount with up to 2 decimal places.'

    if (Object.keys(errors).length > 0) {
      setEditFieldErrors(errors)
      return
    }

    const payload = {
      sessionId: editForm.sessionId,
      termId: editForm.termId,
      name: editForm.name.trim(),
      feeType: editForm.feeType as FeeTypeValue,
      amount: editForm.amount.trim(),
      description: editForm.description.trim() || undefined,
    }

    setSubmitting(true)
    try {
      const updated = await api.updateFee(editing.id, payload)
      setFees((current) => (current ?? []).map((entry) => (entry.id === updated.id ? updated : entry)))
      push('success', `${updated.name} updated.`)
      setEditModalOpen(false)
    } catch (err) {
      const apiError = err as { fieldErrors?: Record<string, string> }
      if (apiError.fieldErrors && Object.keys(apiError.fieldErrors).length > 0) {
        setEditFieldErrors(apiError.fieldErrors)
      } else {
        push('error', err instanceof Error ? err.message : 'Could not save the fee structure.')
      }
    } finally {
      setSubmitting(false)
    }
  }

  const handleToggleStatus = async () => {
    if (!confirmStatus) return
    const { fee, status } = confirmStatus
    setBusyAction('status')
    try {
      const updated = await api.setFeeStatus(fee.id, status)
      setFees((current) => (current ?? []).map((entry) => (entry.id === updated.id ? updated : entry)))
      push('success', status === 'ACTIVE' ? `${updated.name} activated.` : `${updated.name} deactivated.`)
    } catch (err) {
      push('error', err instanceof Error ? err.message : 'Could not update the fee structure.')
    } finally {
      setBusyAction(null)
      setConfirmStatus(null)
    }
  }

  const activeFees = fees?.filter((fee) => fee.status === 'ACTIVE').length ?? 0
  const sessionOptions = sessions.map((session) => ({ value: session.id, label: session.name }))
  const termOptions = terms.map((term) => ({ value: term.id, label: term.name }))

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Fees & Finance"
        title="Fee Structures"
        description="Fee structures belong to an academic session and term. Activate a fee, assign pupils, then generate charges."
        actions={
          canManage ? (
            <Button onClick={openCreate}>
              <Plus className="h-4 w-4" aria-hidden="true" />
              Add Fee Structure
            </Button>
          ) : undefined
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {fees ? (
          <>
            <StatCard
              label="Total Fees"
              value={fees.length}
              hint={`${activeFees} active`}
              icon={<Receipt className="h-5 w-5" aria-hidden="true" />}
              tone="royal"
            />
            <StatCard
              label="Active Fees"
              value={activeFees}
              hint="Available for assignment"
              icon={<Receipt className="h-5 w-5" aria-hidden="true" />}
              tone="green"
            />
            <StatCard
              label="Termly"
              value={fees.filter((fee) => fee.feeType === 'TERMLY').length}
              hint="Charged once per term"
              icon={<Receipt className="h-5 w-5" aria-hidden="true" />}
              tone="magenta"
            />
            <StatCard
              label="Daily"
              value={fees.filter((fee) => fee.feeType === 'DAILY').length}
              hint="Charged per school day"
              icon={<Receipt className="h-5 w-5" aria-hidden="true" />}
              tone="gold"
            />
            <StatCard
              label="PA Fees"
              value={fees.filter((fee) => fee.feeType === 'PA').length}
              hint="PA recurring fees"
              icon={<Receipt className="h-5 w-5" aria-hidden="true" />}
              tone="royal"
            />
          </>
        ) : (
          Array.from({ length: 5 }).map((_, index) => <CardSkeleton key={index} />)
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <SelectField
          label="Session"
          name="sessionFilter"
          value={sessionFilter}
          onChange={(event) => setSessionFilter(event.target.value)}
          options={sessionOptions}
          placeholder="All sessions"
          className="sm:w-64"
        />
        <SelectField
          label="Status"
          name="statusFilter"
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value)}
          options={[
            { value: 'ACTIVE', label: 'Active' },
            { value: 'INACTIVE', label: 'Inactive' },
          ]}
          placeholder="All statuses"
          className="sm:w-48"
        />
      </div>

      {error ? (
        <ErrorState message={error} onRetry={() => void load()} />
      ) : fees === null ? (
        <TableSkeleton rows={6} />
      ) : visibleFees.length === 0 ? (
        <EmptyState
          icon={<Receipt className="h-7 w-7" aria-hidden="true" />}
          title="No fee structures found."
          description={
            fees.length === 0
              ? 'Create a fee structure to begin charging pupils.'
              : 'No fee structures match the selected filters.'
          }
          action={
            canManage && fees.length === 0 ? (
              <Button onClick={openCreate}>
                <Plus className="h-4 w-4" aria-hidden="true" />
                Add Fee Structure
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
                  <th scope="col" className="px-5 py-3.5">Fee</th>
                  <th scope="col" className="px-5 py-3.5">Session</th>
                  <th scope="col" className="px-5 py-3.5">Type</th>
                  <th scope="col" className="px-5 py-3.5">Amount</th>
                  <th scope="col" className="px-5 py-3.5">Assignments</th>
                  <th scope="col" className="px-5 py-3.5">Status</th>
                  <th scope="col" className="px-5 py-3.5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-cream-200">
                {visibleFees.map((fee) => (
                  <tr key={fee.id} className="transition-colors hover:bg-cream-50">
                    <td className="px-5 py-3.5">
                      <p className="font-bold text-ink-900">{fee.name}</p>
                      {fee.description ? <p className="truncate text-xs text-ink-500">{fee.description}</p> : null}
                    </td>
                    <td className="px-5 py-3.5 text-ink-700">{fee.sessionName}</td>
                    <td className="px-5 py-3.5">
                      <Badge tone={fee.feeType === 'TERMLY' ? 'royal' : fee.feeType === 'DAILY' ? 'magenta' : fee.feeType === 'PA' ? 'green' : 'gold'}>
                        {fee.feeType === 'PA' ? 'PA Fees' : fee.feeType}
                      </Badge>
                    </td>
                    <td className="px-5 py-3.5 font-semibold text-ink-900">{formatMoney(fee.amount)}</td>
                    <td className="px-5 py-3.5 text-ink-700">
                      {fee.assignmentCount}
                      <span className="text-xs text-ink-500"> ({fee.activeAssignmentCount} active)</span>
                    </td>
                    <td className="px-5 py-3.5"><StatusBadge status={fee.status} /></td>
                    <td className="px-5 py-3.5">
                      <div className="flex justify-end gap-2">
                        <Button variant="soft" size="sm" to={`${base}/fees/${fee.id}/assignments`}>
                          <Users className="h-4 w-4" aria-hidden="true" />
                          Assignments
                        </Button>
                        {canManage ? (
                          <>
                            <Button variant="soft" size="sm" onClick={() => openEdit(fee)}>
                              <Pencil className="h-4 w-4" aria-hidden="true" />
                              Edit
                            </Button>
                            <Button
                              variant="soft"
                              size="sm"
                              onClick={() =>
                                setConfirmStatus({
                                  fee,
                                  status: fee.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE',
                                })
                              }
                            >
                              {fee.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}
                            </Button>
                          </>
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
      {visibleFees.length > 0 ? (
        <ul className="space-y-3 md:hidden">
          {visibleFees.map((fee) => (
            <li key={fee.id}>
              <Card className="p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-ink-900">{fee.name}</p>
                    <p className="text-xs text-ink-500">
                      {fee.sessionName} · {fee.feeType} · {formatMoney(fee.amount)}
                    </p>
                  </div>
                  <StatusBadge status={fee.status} />
                </div>
                <div className="mt-3 flex flex-wrap justify-end gap-2 border-t border-cream-200 pt-3">
                  <Button variant="soft" size="sm" to={`${base}/fees/${fee.id}/assignments`}>
                    <Users className="h-4 w-4" aria-hidden="true" />
                    Assignments
                  </Button>
                  {canManage ? (
                    <>
                      <Button variant="soft" size="sm" onClick={() => openEdit(fee)}>
                        <Pencil className="h-4 w-4" aria-hidden="true" />
                        Edit
                      </Button>
                      <Button
                        variant="soft"
                        size="sm"
                        onClick={() =>
                          setConfirmStatus({
                            fee,
                            status: fee.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE',
                          })
                        }
                      >
                        {fee.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}
                      </Button>
                    </>
                  ) : null}
                </div>
              </Card>
            </li>
          ))}
        </ul>
      ) : null}

      {/* Create dialog — multi-fee */}
      <Modal
        open={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        title="Add fee structures"
        description="Create one or more fee structures for an academic session and term."
        size="lg"
      >
        <form onSubmit={handleCreateSubmit} noValidate className="grid gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <SelectField
                label="Session"
                name="createSessionId"
                value={createSessionId}
                onChange={(event) => { setCreateSessionId(event.target.value); setCreateTermId('') }}
                options={createSessionOptions}
                placeholder={createSessionOptions.length > 0 ? 'Select a session' : 'No sessions available yet'}
                error={createErrors.sessionId}
                required
              />
            </div>
            <div>
              <SelectField
                label="Term"
                name="createTermId"
                value={createTermId}
                onChange={(event) => setCreateTermId(event.target.value)}
                options={createTermOptions}
                placeholder={!createSessionId ? 'Select a session first' : createTermOptions.length > 0 ? 'Select a term' : 'No terms for this session'}
                error={createErrors.termId}
                required
              />
            </div>
          </div>

          <div className="space-y-4">
            <p className="text-sm font-semibold text-ink-700">Fee components</p>
            {feeRows.map((row, index) => (
              <div key={row.id} className="rounded-lg border border-cream-200 bg-cream-50 p-4">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-ink-500">Fee {index + 1}</span>
                  {feeRows.length > 1 ? (
                    <button
                      type="button"
                      onClick={() => removeRow(row.id)}
                      className="rounded p-1 text-ink-400 transition-colors hover:bg-red-50 hover:text-red-600"
                      aria-label={`Remove fee ${index + 1}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  ) : null}
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <TextField
                    label="Fee name"
                    name={`row_${row.id}_name`}
                    value={row.name}
                    onChange={(event) => updateRow(row.id, 'name', event.target.value)}
                    error={createErrors[`row_${row.id}_name`]}
                    hint="e.g. School Fees"
                    required
                    autoComplete="off"
                  />
                  <SelectField
                    label="Fee type"
                    name={`row_${row.id}_feeType`}
                    value={row.feeType}
                    onChange={(event) => updateRow(row.id, 'feeType', event.target.value)}
                    options={feeTypeOptions}
                    placeholder="Select a fee type"
                    error={createErrors[`row_${row.id}_feeType`]}
                    required
                  />
                  <div className="sm:col-span-2">
                    <TextField
                      label="Amount"
                      name={`row_${row.id}_amount`}
                      inputMode="decimal"
                      value={row.amount}
                      onChange={(event) => updateRow(row.id, 'amount', event.target.value)}
                      error={createErrors[`row_${row.id}_amount`]}
                      hint="Amount in GHS. Up to 2 decimal places."
                      required
                      autoComplete="off"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <TextAreaField
                      label="Description"
                      name={`row_${row.id}_description`}
                      value={row.description}
                      onChange={(event) => updateRow(row.id, 'description', event.target.value)}
                    />
                  </div>
                </div>
              </div>
            ))}
            <Button variant="soft" type="button" onClick={addRow}>
              <Plus className="h-4 w-4" aria-hidden="true" />
              Add another fee
            </Button>
          </div>

          <div className="flex items-center justify-end gap-2 border-t border-cream-200 pt-4">
            <Button variant="cream" type="button" onClick={() => setCreateModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? <Spinner className="h-4 w-4" /> : null}
              Create {feeRows.length > 1 ? `${feeRows.length} fees` : 'fee structure'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Edit dialog — single fee */}
      <Modal
        open={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        title="Edit fee structure"
        description={editing ? `Update the details of ${editing.name}.` : 'Update the fee structure.'}
        size="lg"
      >
        <form onSubmit={handleEditSubmit} noValidate className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <SelectField
              label="Session"
              name="editSessionId"
              value={editForm.sessionId}
              onChange={(event) => { setEditForm((c) => ({ ...c, sessionId: event.target.value, termId: '' })) }}
              options={sessionOptions}
              placeholder="Select a session"
              error={editFieldErrors.sessionId}
              required
            />
          </div>
          <div className="sm:col-span-2">
            <SelectField
              label="Term"
              name="editTermId"
              value={editForm.termId}
              onChange={(event) => setEditForm((c) => ({ ...c, termId: event.target.value }))}
              options={termOptions}
              placeholder={!editForm.sessionId ? 'Select a session first' : 'Select a term'}
              error={editFieldErrors.termId}
              required
            />
          </div>
          <TextField
            label="Fee name"
            name="editName"
            value={editForm.name}
            onChange={(event) => setEditForm((c) => ({ ...c, name: event.target.value }))}
            error={editFieldErrors.name}
            required
            autoComplete="off"
          />
          <SelectField
            label="Fee type"
            name="editFeeType"
            value={editForm.feeType}
            onChange={(event) => setEditForm((c) => ({ ...c, feeType: event.target.value as FeeTypeValue | '' }))}
            options={feeTypeOptions}
            placeholder="Select a fee type"
            error={editFieldErrors.feeType}
            required
          />
          <div className="sm:col-span-2">
            <TextField
              label="Amount"
              name="editAmount"
              inputMode="decimal"
              value={editForm.amount}
              onChange={(event) => setEditForm((c) => ({ ...c, amount: event.target.value }))}
              error={editFieldErrors.amount}
              required
              autoComplete="off"
            />
          </div>
          <div className="sm:col-span-2">
            <TextAreaField
              label="Description"
              name="editDescription"
              value={editForm.description}
              onChange={(event) => setEditForm((c) => ({ ...c, description: event.target.value }))}
            />
          </div>
          <div className="flex items-center justify-end gap-2 sm:col-span-2">
            <Button variant="cream" type="button" onClick={() => setEditModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? <Spinner className="h-4 w-4" /> : null}
              Save changes
            </Button>
          </div>
        </form>
      </Modal>

      {/* Status confirm */}
      {confirmStatus ? (
        <ConfirmDialog
          open
          title={confirmStatus.status === 'ACTIVE' ? 'Activate fee structure' : 'Deactivate fee structure'}
          message={
            confirmStatus.status === 'ACTIVE'
              ? `Activating ${confirmStatus.fee.name} makes it available for pupil assignments and charges.`
              : `Deactivating ${confirmStatus.fee.name} prevents new assignments and charges. Existing charges and payments are kept.`
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
