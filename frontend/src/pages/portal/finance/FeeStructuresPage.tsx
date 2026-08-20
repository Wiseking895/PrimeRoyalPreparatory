import { useCallback, useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Pencil, Plus, Receipt, Users } from 'lucide-react'
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
import type { AccountStatusValue, AcademicSessionView, FeeTypeValue, FeeView } from '@/types/portal'

interface FeeForm {
  sessionId: string
  name: string
  feeType: FeeTypeValue | ''
  amount: string
  description: string
}

const emptyForm: FeeForm = { sessionId: '', name: '', feeType: '', amount: '', description: '' }

const feeTypeOptions: Array<{ value: FeeTypeValue; label: string }> = [
  { value: 'TERMLY', label: 'Termly' },
  { value: 'DAILY', label: 'Daily' },
  { value: 'OTHER', label: 'Other' },
]

export function FeeStructuresPage() {
  const { push } = useToast()
  const { user, hasPermission } = useAuth()
  const base = financeRoute(user?.roles ?? [])

  const canManage = hasPermission('fees.manage')

  const [fees, setFees] = useState<FeeView[] | null>(null)
  const [sessions, setSessions] = useState<AcademicSessionView[]>([])
  const [sessionFilter, setSessionFilter] = useState<string>('')
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [error, setError] = useState<string | null>(null)

  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<FeeView | null>(null)
  const [form, setForm] = useState<FeeForm>(emptyForm)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)

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

  const visibleFees = (fees ?? []).filter((fee) => {
    if (sessionFilter && fee.sessionId !== sessionFilter) return false
    if (statusFilter && fee.status !== statusFilter) return false
    return true
  })

  const openCreate = () => {
    setEditing(null)
    setForm({ ...emptyForm, sessionId: sessions.find((session) => session.status === 'ACTIVE')?.id ?? '' })
    setFieldErrors({})
    setModalOpen(true)
  }

  const openEdit = (fee: FeeView) => {
    setEditing(fee)
    setForm({
      sessionId: fee.sessionId,
      name: fee.name,
      feeType: fee.feeType,
      amount: fee.amount,
      description: fee.description ?? '',
    })
    setFieldErrors({})
    setModalOpen(true)
  }

  const set = (field: keyof FeeForm, value: string) => {
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
    if (!form.sessionId) errors.sessionId = 'Select a session.'
    if (form.name.trim().length < 2) errors.name = 'Fee name must be at least 2 characters.'
    if (!form.feeType) errors.feeType = 'Select a fee type.'
    if (!isValidMoney(form.amount)) errors.amount = 'Enter a valid amount with up to 2 decimal places.'
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors)
      return
    }

    const payload = {
      sessionId: form.sessionId,
      name: form.name.trim(),
      feeType: form.feeType as FeeTypeValue,
      amount: form.amount.trim(),
      description: form.description.trim() || undefined,
    }

    setSubmitting(true)
    try {
      if (editing) {
        const updated = await api.updateFee(editing.id, payload)
        setFees((current) => (current ?? []).map((entry) => (entry.id === updated.id ? updated : entry)))
        push('success', `${updated.name} updated.`)
      } else {
        const created = await api.createFee(payload)
        setFees((current) => (current ? [...current, created] : [created]))
        push('success', `${created.name} created.`)
      }
      setModalOpen(false)
    } catch (err) {
      const apiError = err as { fieldErrors?: Record<string, string> }
      if (apiError.fieldErrors && Object.keys(apiError.fieldErrors).length > 0) {
        setFieldErrors(apiError.fieldErrors)
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

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Fees & Finance"
        title="Fee Structures"
        description="Fee structures belong to an academic session. Activate a fee, assign pupils, then generate charges."
        actions={
          canManage ? (
            <Button onClick={openCreate}>
              <Plus className="h-4 w-4" aria-hidden="true" />
              Add Fee Structure
            </Button>
          ) : undefined
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
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
          </>
        ) : (
          Array.from({ length: 4 }).map((_, index) => <CardSkeleton key={index} />)
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
                  <th scope="col" className="px-5 py-3.5">Charges</th>
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
                      <Badge tone={fee.feeType === 'TERMLY' ? 'royal' : fee.feeType === 'DAILY' ? 'magenta' : 'gold'}>
                        {fee.feeType}
                      </Badge>
                    </td>
                    <td className="px-5 py-3.5 font-semibold text-ink-900">{formatMoney(fee.amount)}</td>
                    <td className="px-5 py-3.5 text-ink-700">
                      {fee.assignmentCount}
                      <span className="text-xs text-ink-500"> ({fee.activeAssignmentCount} active)</span>
                    </td>
                    <td className="px-5 py-3.5 text-ink-700">{fee.chargeCount}</td>
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

      {/* Create / edit dialog */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Edit fee structure' : 'Add fee structure'}
        description={
          editing ? `Update the details of ${editing.name}.` : 'Create a fee structure for an academic session.'
        }
        size="lg"
      >
        <form onSubmit={handleSubmit} noValidate className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <SelectField
              label="Session"
              name="sessionId"
              value={form.sessionId}
              onChange={(event) => set('sessionId', event.target.value)}
              options={sessionOptions}
              placeholder={sessionOptions.length > 0 ? 'Select a session' : 'No sessions available yet'}
              error={fieldErrors.sessionId}
              required
            />
          </div>
          <TextField
            label="Fee name"
            name="name"
            value={form.name}
            onChange={(event) => set('name', event.target.value)}
            error={fieldErrors.name}
            hint="e.g. School Fees."
            required
            autoComplete="off"
          />
          <SelectField
            label="Fee type"
            name="feeType"
            value={form.feeType}
            onChange={(event) => set('feeType', event.target.value)}
            options={feeTypeOptions}
            placeholder="Select a fee type"
            error={fieldErrors.feeType}
            required
          />
          <div className="sm:col-span-2">
            <TextField
              label="Amount"
              name="amount"
              inputMode="decimal"
              value={form.amount}
              onChange={(event) => set('amount', event.target.value)}
              error={fieldErrors.amount}
              hint="Amount in the school's currency. Up to 2 decimal places."
              required
              autoComplete="off"
            />
          </div>
          <div className="sm:col-span-2">
            <TextAreaField
              label="Description"
              name="description"
              value={form.description}
              onChange={(event) => set('description', event.target.value)}
              error={fieldErrors.description}
            />
          </div>
          <div className="flex items-center justify-end gap-2 sm:col-span-2">
            <Button variant="cream" type="button" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? <Spinner className="h-4 w-4" /> : null}
              {editing ? 'Save changes' : 'Create fee structure'}
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