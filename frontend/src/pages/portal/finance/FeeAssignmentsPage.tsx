import { useCallback, useEffect, useState } from 'react'
import { ArrowLeft, ListChecks, Plus, UserRound } from 'lucide-react'
import { useParams } from 'react-router-dom'
import { useAuth } from '@/auth/AuthContext'
import { PageHeader } from '@/components/dashboard/PageHeader'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { StatusBadge, Badge } from '@/components/dashboard/Badge'
import { ConfirmDialog } from '@/components/dashboard/ConfirmDialog'
import { Modal } from '@/components/dashboard/Modal'
import { TextField } from '@/components/dashboard/Field'
import { Spinner, TableSkeleton } from '@/components/dashboard/Loaders'
import { EmptyState, ErrorState } from '@/components/dashboard/States'
import { useToast } from '@/components/dashboard/Toast'
import { api } from '@/lib/api'
import { financeRoute } from './financeRoute'
import type { FeeAssignmentView, FeeView, PupilBalanceView } from '@/types/portal'

export function FeeAssignmentsPage() {
  const { id } = useParams<{ id: string }>()
  const { push } = useToast()
  const { user, hasPermission } = useAuth()
  const base = financeRoute(user?.roles ?? [])

  const canManage = hasPermission('fees.manage')

  const [fee, setFee] = useState<FeeView | null>(null)
  const [assignments, setAssignments] = useState<FeeAssignmentView[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  const [assignOpen, setAssignOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [pupils, setPupils] = useState<PupilBalanceView[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [searching, setSearching] = useState(false)
  const [assigning, setAssigning] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)

  const [confirmDeactivate, setConfirmDeactivate] = useState<FeeAssignmentView | null>(null)
  const [confirmCharges, setConfirmCharges] = useState(false)
  const [busyAction, setBusyAction] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!id) return
    setError(null)
    try {
      const [feeData, assignmentData] = await Promise.all([api.getFee(id), api.listFeeAssignments(id)])
      setFee(feeData)
      setAssignments(assignmentData)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load fee assignments.')
    }
  }, [id])

  useEffect(() => {
    void load()
  }, [load])

  const runSearch = useCallback(async () => {
    setSearching(true)
    setSearchError(null)
    try {
      const result = await api.listFinancePupils({ q: search.trim() || undefined, pageSize: 100 })
      setPupils(result.items)
    } catch (err) {
      setSearchError(err instanceof Error ? err.message : 'Could not search pupils.')
    } finally {
      setSearching(false)
    }
  }, [search])

  const openAssign = () => {
    setSelected(new Set())
    setSearch('')
    setPupils([])
    setSearchError(null)
    setAssignOpen(true)
  }

  const alreadyAssigned = new Set((assignments ?? []).filter((entry) => entry.status === 'ACTIVE').map((entry) => entry.pupilId))
  const assignablePupils = pupils.filter((pupil) => !alreadyAssigned.has(pupil.id))

  const togglePupil = (pupilId: string) => {
    setSelected((current) => {
      const next = new Set(current)
      if (next.has(pupilId)) next.delete(pupilId)
      else next.add(pupilId)
      return next
    })
  }

  const handleAssign = async () => {
    if (!id || selected.size === 0) return
    setAssigning(true)
    try {
      const result = await api.assignFee(id, [...selected])
      setAssignOpen(false)
      await load()
      push('success', `Assigned ${result.assigned} pupil(s) to ${fee?.name ?? 'the fee'}.`)
    } catch (err) {
      push('error', err instanceof Error ? err.message : 'Could not assign pupils.')
    } finally {
      setAssigning(false)
    }
  }

  const handleDeactivate = async () => {
    if (!confirmDeactivate) return
    setBusyAction('deactivate')
    try {
      const updated = await api.deactivateAssignment(confirmDeactivate.id)
      setAssignments((current) => (current ?? []).map((entry) => (entry.id === updated.id ? updated : entry)))
      push('success', `Assignment for ${updated.pupilName} deactivated.`)
    } catch (err) {
      push('error', err instanceof Error ? err.message : 'Could not deactivate the assignment.')
    } finally {
      setBusyAction(null)
      setConfirmDeactivate(null)
    }
  }

  const handleGenerateCharges = async () => {
    if (!id) return
    setBusyAction('charges')
    try {
      const result = await api.generateFeeCharges(id)
      setConfirmCharges(false)
      await load()
      push('success', `Generated ${result.created} charge(s).`)
    } catch (err) {
      push('error', err instanceof Error ? err.message : 'Could not generate charges.')
    } finally {
      setBusyAction(null)
    }
  }

  const activeAssignments = (assignments ?? []).filter((entry) => entry.status === 'ACTIVE')

  if (error) {
    return (
      <div className="space-y-6">
        <Button variant="ghost-dark" size="sm" to={`${base}/fees`}>
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Back to fee structures
        </Button>
        <ErrorState message={error} onRetry={() => void load()} />
      </div>
    )
  }

  if (!fee || assignments === null) {
    return (
      <div className="space-y-6">
        <TableSkeleton rows={5} />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Fees & Finance"
        title={fee.name}
        description={`${fee.sessionName} · ${fee.feeType} · ${fee.amount}. Assign the fee to active pupils, then generate charges.`}
        actions={
          <>
            <Button variant="ghost-dark" size="sm" to={`${base}/fees`}>
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              Back to fees
            </Button>
            {canManage ? (
              <>
                <Button
                  variant="soft"
                  onClick={() => setConfirmCharges(true)}
                  disabled={activeAssignments.length === 0}
                >
                  <ListChecks className="h-4 w-4" aria-hidden="true" />
                  Generate charges
                </Button>
                <Button onClick={openAssign} disabled={fee.status === 'INACTIVE'}>
                  <Plus className="h-4 w-4" aria-hidden="true" />
                  Assign pupils
                </Button>
              </>
            ) : null}
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="p-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-ink-500">Assignments</p>
          <p className="mt-1 text-2xl font-extrabold text-ink-900">{assignments.length}</p>
          <p className="text-xs text-ink-500">{activeAssignments.length} active</p>
        </Card>
        <Card className="p-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-ink-500">Active</p>
          <p className="mt-1 text-2xl font-extrabold text-ink-900">{activeAssignments.length}</p>
          <p className="text-xs text-ink-500">Chargeable pupils</p>
        </Card>
        <Card className="p-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-ink-500">Charges</p>
          <p className="mt-1 text-2xl font-extrabold text-ink-900">{fee.chargeCount}</p>
          <p className="text-xs text-ink-500">Generated so far</p>
        </Card>
      </div>

      {assignments.length === 0 ? (
        <EmptyState
          icon={<UserRound className="h-7 w-7" aria-hidden="true" />}
          title="No pupils assigned yet."
          description="Assign pupils to this fee so charges can be generated for them."
          action={
            canManage && fee.status === 'ACTIVE' ? (
              <Button onClick={openAssign}>
                <Plus className="h-4 w-4" aria-hidden="true" />
                Assign pupils
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
                  <th scope="col" className="px-5 py-3.5">Pupil</th>
                  <th scope="col" className="px-5 py-3.5">Pupil ID</th>
                  <th scope="col" className="px-5 py-3.5">Class</th>
                  <th scope="col" className="px-5 py-3.5">Charges</th>
                  <th scope="col" className="px-5 py-3.5">Status</th>
                  {canManage ? <th scope="col" className="px-5 py-3.5 text-right">Action</th> : null}
                </tr>
              </thead>
              <tbody className="divide-y divide-cream-200">
                {assignments.map((entry) => (
                  <tr key={entry.id} className="transition-colors hover:bg-cream-50">
                    <td className="px-5 py-3.5 font-bold text-ink-900">{entry.pupilName}</td>
                    <td className="px-5 py-3.5">
                      <span className="rounded-full bg-royal-600/10 px-2.5 py-1 text-xs font-semibold text-royal-700">
                        {entry.pupilCode}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-ink-700">{entry.className}</td>
                    <td className="px-5 py-3.5 text-ink-700">{entry.chargeCount}</td>
                    <td className="px-5 py-3.5"><StatusBadge status={entry.status} /></td>
                    {canManage ? (
                      <td className="px-5 py-3.5">
                        <div className="flex justify-end gap-2">
                          {entry.status === 'ACTIVE' ? (
                            <Button
                              variant="soft"
                              size="sm"
                              onClick={() => setConfirmDeactivate(entry)}
                            >
                              Deactivate
                            </Button>
                          ) : null}
                        </div>
                      </td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Mobile list */}
      {assignments.length > 0 ? (
        <ul className="space-y-3 md:hidden">
          {assignments.map((entry) => (
            <li key={entry.id}>
              <Card className="p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-ink-900">{entry.pupilName}</p>
                    <p className="text-xs text-ink-500">
                      {entry.pupilCode} · {entry.className}
                    </p>
                  </div>
                  <StatusBadge status={entry.status} />
                </div>
                {canManage && entry.status === 'ACTIVE' ? (
                  <div className="mt-3 flex flex-wrap justify-end gap-2 border-t border-cream-200 pt-3">
                    <Button variant="soft" size="sm" onClick={() => setConfirmDeactivate(entry)}>
                      Deactivate
                    </Button>
                  </div>
                ) : null}
              </Card>
            </li>
          ))}
        </ul>
      ) : null}

      {/* Assign pupils dialog */}
      <Modal
        open={assignOpen}
        onClose={() => setAssignOpen(false)}
        title="Assign pupils"
        description={`Select pupils to assign to ${fee.name}.`}
        size="lg"
      >
        <div className="space-y-4">
          <div className="flex gap-2">
            <TextField
              label="Search pupils"
              name="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Name or pupil ID"
              autoComplete="off"
              className="flex-1"
            />
            <div className="flex items-end">
              <Button variant="soft" onClick={() => void runSearch()} disabled={searching}>
                {searching ? <Spinner className="h-4 w-4" /> : null}
                Search
              </Button>
            </div>
          </div>
          {searchError ? <p role="alert" className="text-xs font-medium text-red-600">{searchError}</p> : null}
          {pupils.length > 0 ? (
            <div className="max-h-80 space-y-2 overflow-y-auto rounded-xl border border-cream-200 p-3">
              {assignablePupils.length === 0 ? (
                <p className="px-2 py-3 text-sm text-ink-500">
                  All matching pupils are already assigned to this fee.
                </p>
              ) : (
                assignablePupils.map((pupil) => (
                  <label
                    key={pupil.id}
                    className="flex cursor-pointer items-start gap-3 rounded-xl border border-cream-200 bg-cream-50 p-3"
                  >
                    <input
                      type="checkbox"
                      checked={selected.has(pupil.id)}
                      onChange={() => togglePupil(pupil.id)}
                      className="mt-0.5 h-4 w-4 rounded border-cream-300 text-magenta-600 focus:ring-magenta-500"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-bold text-ink-900">{pupil.fullName}</span>
                      <span className="block text-xs text-ink-500">
                        {pupil.pupilId} · {pupil.className}
                      </span>
                    </span>
                    <Badge tone={Number(pupil.outstanding) > 0 ? 'amber' : 'green'}>
                      {Number(pupil.outstanding) > 0 ? 'Outstanding' : 'Balanced'}
                    </Badge>
                  </label>
                ))
              )}
            </div>
          ) : null}
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm text-ink-500">{selected.size} pupil(s) selected</span>
            <div className="flex gap-2">
              <Button variant="cream" type="button" onClick={() => setAssignOpen(false)}>
                Cancel
              </Button>
              <Button onClick={() => void handleAssign()} disabled={selected.size === 0 || assigning}>
                {assigning ? <Spinner className="h-4 w-4" /> : null}
                Assign
              </Button>
            </div>
          </div>
        </div>
      </Modal>

      {/* Deactivate assignment confirm */}
      {confirmDeactivate ? (
        <ConfirmDialog
          open
          title="Deactivate assignment"
          message={`Deactivating the assignment for ${confirmDeactivate.pupilName} stops future charges for this fee. Any outstanding charges without payments are cancelled; records are kept.`}
          confirmLabel="Deactivate"
          loading={busyAction === 'deactivate'}
          onConfirm={() => void handleDeactivate()}
          onCancel={() => setConfirmDeactivate(null)}
        />
      ) : null}

      {/* Generate charges confirm */}
      <ConfirmDialog
        open={confirmCharges}
        title="Generate charges"
        message={`Generate charges for all ${activeAssignments.length} active assignment(s) on ${fee.name}? Existing charges are not duplicated.`}
        confirmLabel="Generate charges"
        loading={busyAction === 'charges'}
        onConfirm={() => void handleGenerateCharges()}
        onCancel={() => setConfirmCharges(false)}
      />
    </div>
  )
}