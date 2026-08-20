import { useCallback, useEffect, useState } from 'react'
import { ListChecks, Receipt, Sparkles } from 'lucide-react'
import { useAuth } from '@/auth/AuthContext'
import { PageHeader } from '@/components/dashboard/PageHeader'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Badge, StatusBadge } from '@/components/dashboard/Badge'
import { SelectField } from '@/components/dashboard/Field'
import { ConfirmDialog } from '@/components/dashboard/ConfirmDialog'
import { TableSkeleton } from '@/components/dashboard/Loaders'
import { EmptyState, ErrorState } from '@/components/dashboard/States'
import { useToast } from '@/components/dashboard/Toast'
import { api } from '@/lib/api'
import { formatMoney } from '@/lib/money'
import type { AcademicSessionView, FeeView } from '@/types/portal'

export function ChargeGenerationPage() {
  const { push } = useToast()
  const { hasPermission } = useAuth()

  const canManage = hasPermission('fees.manage')

  const [sessions, setSessions] = useState<AcademicSessionView[]>([])
  const [fees, setFees] = useState<FeeView[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  const [selectedSession, setSelectedSession] = useState<string>('')
  const [confirmAll, setConfirmAll] = useState(false)
  const [confirmFee, setConfirmFee] = useState<FeeView | null>(null)
  const [busyAction, setBusyAction] = useState<string | null>(null)

  const load = useCallback(async () => {
    setError(null)
    try {
      const sessionData = await api.listSessions()
      setSessions(sessionData)
      const active = sessionData.find((session) => session.status === 'ACTIVE')?.id ?? sessionData[0]?.id ?? ''
      setSelectedSession((current) => current || active)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load sessions.')
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (!selectedSession) {
      setFees([])
      return
    }
    let active = true
    setError(null)
    api
      .listFees({ sessionId: selectedSession })
      .then((data) => {
        if (active) setFees(data)
      })
      .catch((err) => {
        if (active) setError(err instanceof Error ? err.message : 'Could not load fees.')
      })
    return () => {
      active = false
    }
  }, [selectedSession])

  const handleGenerateAll = async () => {
    if (!selectedSession) return
    setBusyAction('all')
    try {
      const result = await api.generateSessionCharges(selectedSession)
      setConfirmAll(false)
      push('success', `Generated ${result.created} charge(s) across the session.`)
    } catch (err) {
      push('error', err instanceof Error ? err.message : 'Could not generate charges.')
    } finally {
      setBusyAction(null)
    }
  }

  const handleGenerateFee = async () => {
    if (!confirmFee) return
    setBusyAction('fee')
    try {
      const result = await api.generateFeeCharges(confirmFee.id)
      setConfirmFee(null)
      push('success', `Generated ${result.created} charge(s) for ${confirmFee.name}.`)
    } catch (err) {
      push('error', err instanceof Error ? err.message : 'Could not generate charges.')
    } finally {
      setBusyAction(null)
    }
  }

  const sessionOptions = sessions.map((session) => ({ value: session.id, label: session.name }))
  const activeFees = (fees ?? []).filter((fee) => fee.status === 'ACTIVE' && fee.activeAssignmentCount > 0)
  const alreadyGenerated = (fees ?? []).filter((fee) => fee.chargeCount > 0).length

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Fees & Finance"
        title="Charge Generation"
        description="Generate charges for assigned pupils. Termly fees are charged once per term; daily fees are charged for each school day of the active term."
      />

      <div className="flex flex-wrap items-end gap-3">
        <SelectField
          label="Academic session"
          name="session"
          value={selectedSession}
          onChange={(event) => setSelectedSession(event.target.value)}
          options={sessionOptions}
          placeholder={sessionOptions.length > 0 ? 'Select a session' : 'No sessions available yet'}
          className="sm:w-80"
        />
        {canManage && selectedSession ? (
          <Button onClick={() => setConfirmAll(true)} disabled={(activeFees.length === 0)}>
            <Sparkles className="h-4 w-4" aria-hidden="true" />
            Generate all charges
          </Button>
        ) : null}
      </div>

      {error ? (
        <ErrorState message={error} onRetry={() => void load()} />
      ) : fees === null ? (
        <TableSkeleton rows={5} />
      ) : sessions.length === 0 ? (
        <EmptyState
          icon={<Receipt className="h-7 w-7" aria-hidden="true" />}
          title="No academic sessions available."
          description="Sessions and terms are created by academic administration."
        />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <Card className="p-5">
              <p className="text-xs font-semibold uppercase tracking-wider text-ink-500">Fees in session</p>
              <p className="mt-1 text-2xl font-extrabold text-ink-900">{fees.length}</p>
            </Card>
            <Card className="p-5">
              <p className="text-xs font-semibold uppercase tracking-wider text-ink-500">Chargeable fees</p>
              <p className="mt-1 text-2xl font-extrabold text-ink-900">{activeFees.length}</p>
              <p className="text-xs text-ink-500">Active with assigned pupils</p>
            </Card>
            <Card className="p-5">
              <p className="text-xs font-semibold uppercase tracking-wider text-ink-500">Already generated</p>
              <p className="mt-1 text-2xl font-extrabold text-ink-900">{alreadyGenerated}</p>
              <p className="text-xs text-ink-500">Charges exist for these fees</p>
            </Card>
          </div>

          {fees.length === 0 ? (
            <EmptyState
              icon={<Receipt className="h-7 w-7" aria-hidden="true" />}
              title="No fee structures in this session."
              description="Create fee structures for the session before generating charges."
            />
          ) : (
            <Card className="hidden overflow-hidden md:block">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-cream-200 bg-cream-50 text-xs font-bold uppercase tracking-wider text-ink-500">
                    <tr>
                      <th scope="col" className="px-5 py-3.5">Fee</th>
                      <th scope="col" className="px-5 py-3.5">Type</th>
                      <th scope="col" className="px-5 py-3.5">Amount</th>
                      <th scope="col" className="px-5 py-3.5">Active assignments</th>
                      <th scope="col" className="px-5 py-3.5">Charges</th>
                      <th scope="col" className="px-5 py-3.5">Status</th>
                      {canManage ? <th scope="col" className="px-5 py-3.5 text-right">Action</th> : null}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-cream-200">
                    {fees.map((fee) => (
                      <tr key={fee.id} className="transition-colors hover:bg-cream-50">
                        <td className="px-5 py-3.5 font-bold text-ink-900">{fee.name}</td>
                        <td className="px-5 py-3.5">
                          <Badge tone={fee.feeType === 'TERMLY' ? 'royal' : fee.feeType === 'DAILY' ? 'magenta' : 'gold'}>
                            {fee.feeType}
                          </Badge>
                        </td>
                        <td className="px-5 py-3.5 font-semibold text-ink-900">{formatMoney(fee.amount)}</td>
                        <td className="px-5 py-3.5 text-ink-700">{fee.activeAssignmentCount}</td>
                        <td className="px-5 py-3.5 text-ink-700">{fee.chargeCount}</td>
                        <td className="px-5 py-3.5"><StatusBadge status={fee.status} /></td>
                        {canManage ? (
                          <td className="px-5 py-3.5">
                            <div className="flex justify-end">
                              <Button
                                variant="soft"
                                size="sm"
                                onClick={() => setConfirmFee(fee)}
                                disabled={fee.status === 'INACTIVE' || fee.activeAssignmentCount === 0}
                              >
                                <ListChecks className="h-4 w-4" aria-hidden="true" />
                                Generate
                              </Button>
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

          {fees.length > 0 ? (
            <ul className="space-y-3 md:hidden">
              {fees.map((fee) => (
                <li key={fee.id}>
                  <Card className="p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold text-ink-900">{fee.name}</p>
                        <p className="text-xs text-ink-500">
                          {fee.feeType} · {formatMoney(fee.amount)} · {fee.activeAssignmentCount} assignment(s)
                        </p>
                      </div>
                      <StatusBadge status={fee.status} />
                    </div>
                    {canManage ? (
                      <div className="mt-3 flex flex-wrap justify-end gap-2 border-t border-cream-200 pt-3">
                        <Button
                          variant="soft"
                          size="sm"
                          onClick={() => setConfirmFee(fee)}
                          disabled={fee.status === 'INACTIVE' || fee.activeAssignmentCount === 0}
                        >
                          <ListChecks className="h-4 w-4" aria-hidden="true" />
                          Generate charges
                        </Button>
                      </div>
                    ) : null}
                  </Card>
                </li>
              ))}
            </ul>
          ) : null}
        </>
      )}

      {/* Generate all confirm */}
      <ConfirmDialog
        open={confirmAll}
        title="Generate all charges"
        message={`Generate charges for every active fee with assigned pupils in this session? Termly fees are charged once; daily fees are charged for each school day of the active term. Existing charges are not duplicated.`}
        confirmLabel="Generate charges"
        loading={busyAction === 'all'}
        onConfirm={() => void handleGenerateAll()}
        onCancel={() => setConfirmAll(false)}
      />

      {/* Generate per-fee confirm */}
      {confirmFee ? (
        <ConfirmDialog
          open
          title="Generate charges"
          message={`Generate charges for ${confirmFee.name} (${confirmFee.activeAssignmentCount} active assignment(s))? Existing charges are not duplicated.`}
          confirmLabel="Generate charges"
          loading={busyAction === 'fee'}
          onConfirm={() => void handleGenerateFee()}
          onCancel={() => setConfirmFee(null)}
        />
      ) : null}
    </div>
  )
}