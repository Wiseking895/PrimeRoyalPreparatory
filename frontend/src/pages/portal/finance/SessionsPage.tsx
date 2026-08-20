import { useCallback, useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { BookOpenCheck, CalendarDays, Pencil, Plus } from 'lucide-react'
import { useAuth } from '@/auth/AuthContext'
import { PageHeader } from '@/components/dashboard/PageHeader'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { StatusBadge } from '@/components/dashboard/Badge'
import { ConfirmDialog } from '@/components/dashboard/ConfirmDialog'
import { Modal } from '@/components/dashboard/Modal'
import { TextField, SelectField } from '@/components/dashboard/Field'
import { Spinner, CardSkeleton, TableSkeleton } from '@/components/dashboard/Loaders'
import { EmptyState, ErrorState } from '@/components/dashboard/States'
import { StatCard } from '@/components/dashboard/StatCard'
import { useToast } from '@/components/dashboard/Toast'
import { api } from '@/lib/api'
import { formatDate } from '@/lib/date'
import { toDateInputValue } from '@/lib/dateInput'
import type { AcademicSessionView, AcademicTermView, AccountStatusValue } from '@/types/portal'

interface SessionForm {
  name: string
  startDate: string
  endDate: string
}

interface TermForm {
  sessionId: string
  name: string
  termNumber: string
  startDate: string
  endDate: string
  schoolDays: string
}

const emptySessionForm: SessionForm = { name: '', startDate: '', endDate: '' }
const emptyTermForm: TermForm = { sessionId: '', name: '', termNumber: '', startDate: '', endDate: '', schoolDays: '' }

type ConfirmState =
  | { kind: 'session'; record: AcademicSessionView; status: AccountStatusValue }
  | { kind: 'term'; record: AcademicTermView; status: AccountStatusValue }
  | null

export function SessionsPage() {
  const { push } = useToast()
  const { hasPermission } = useAuth()

  const canManage = hasPermission('academic.manage')

  const [sessions, setSessions] = useState<AcademicSessionView[] | null>(null)
  const [terms, setTerms] = useState<AcademicTermView[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  const [sessionModal, setSessionModal] = useState(false)
  const [editingSession, setEditingSession] = useState<AcademicSessionView | null>(null)
  const [sessionForm, setSessionForm] = useState<SessionForm>(emptySessionForm)
  const [sessionErrors, setSessionErrors] = useState<Record<string, string>>({})

  const [termModal, setTermModal] = useState(false)
  const [editingTerm, setEditingTerm] = useState<AcademicTermView | null>(null)
  const [termForm, setTermForm] = useState<TermForm>(emptyTermForm)
  const [termErrors, setTermErrors] = useState<Record<string, string>>({})

  const [confirm, setConfirm] = useState<ConfirmState>(null)
  const [busyAction, setBusyAction] = useState<string | null>(null)

  const load = useCallback(async () => {
    setError(null)
    try {
      const [sessionData, termData] = await Promise.all([api.listSessions(), api.listTerms()])
      setSessions(sessionData)
      setTerms(termData)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load sessions and terms.')
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const openCreateSession = () => {
    setEditingSession(null)
    setSessionForm(emptySessionForm)
    setSessionErrors({})
    setSessionModal(true)
  }

  const openEditSession = (session: AcademicSessionView) => {
    setEditingSession(session)
    setSessionForm({
      name: session.name,
      startDate: toDateInputValue(session.startDate),
      endDate: toDateInputValue(session.endDate),
    })
    setSessionErrors({})
    setSessionModal(true)
  }

  const openCreateTerm = () => {
    setEditingTerm(null)
    setTermForm({ ...emptyTermForm, sessionId: sessions?.find((session) => session.status === 'ACTIVE')?.id ?? '' })
    setTermErrors({})
    setTermModal(true)
  }

  const openEditTerm = (term: AcademicTermView) => {
    setEditingTerm(term)
    setTermForm({
      sessionId: term.sessionId,
      name: term.name,
      termNumber: String(term.termNumber),
      startDate: toDateInputValue(term.startDate),
      endDate: toDateInputValue(term.endDate),
      schoolDays: term.schoolDays === 0 ? '' : String(term.schoolDays),
    })
    setTermErrors({})
    setTermModal(true)
  }

  const setSessionField = (field: keyof SessionForm, value: string) => {
    setSessionForm((current) => ({ ...current, [field]: value }))
    setSessionErrors((current) => {
      if (!current[field]) return current
      const next = { ...current }
      delete next[field]
      return next
    })
  }

  const setTermField = (field: keyof TermForm, value: string) => {
    setTermForm((current) => ({ ...current, [field]: value }))
    setTermErrors((current) => {
      if (!current[field]) return current
      const next = { ...current }
      delete next[field]
      return next
    })
  }

  const handleSessionSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const errors: Record<string, string> = {}
    if (sessionForm.name.trim().length < 2) errors.name = 'Session name must be at least 2 characters.'
    if (!sessionForm.startDate) errors.startDate = 'Start date is required.'
    if (!sessionForm.endDate) errors.endDate = 'End date is required.'
    if (sessionForm.startDate && sessionForm.endDate && sessionForm.endDate <= sessionForm.startDate) {
      errors.endDate = 'The end date must be after the start date.'
    }
    if (Object.keys(errors).length > 0) {
      setSessionErrors(errors)
      return
    }

    setBusyAction('session')
    try {
      if (editingSession) {
        const updated = await api.updateSession(editingSession.id, {
          name: sessionForm.name.trim(),
          startDate: sessionForm.startDate,
          endDate: sessionForm.endDate,
        })
        setSessions((current) => (current ?? []).map((entry) => (entry.id === updated.id ? updated : entry)))
        push('success', `${updated.name} updated.`)
      } else {
        const created = await api.createSession({
          name: sessionForm.name.trim(),
          startDate: sessionForm.startDate,
          endDate: sessionForm.endDate,
        })
        setSessions((current) => (current ? [...current, created] : [created]))
        push('success', `${created.name} created.`)
      }
      setSessionModal(false)
    } catch (err) {
      const apiError = err as { fieldErrors?: Record<string, string> }
      if (apiError.fieldErrors && Object.keys(apiError.fieldErrors).length > 0) {
        setSessionErrors(apiError.fieldErrors)
      } else {
        push('error', err instanceof Error ? err.message : 'Could not save the session.')
      }
    } finally {
      setBusyAction(null)
    }
  }

  const handleTermSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const errors: Record<string, string> = {}
    if (!termForm.sessionId) errors.sessionId = 'Select a session.'
    if (termForm.name.trim().length < 1) errors.name = 'Term name is required.'
    const termNumber = Number(termForm.termNumber)
    if (!Number.isInteger(termNumber) || termNumber < 1 || termNumber > 12) {
      errors.termNumber = 'Term number must be a whole number between 1 and 12.'
    }
    if (!termForm.startDate) errors.startDate = 'Start date is required.'
    if (!termForm.endDate) errors.endDate = 'End date is required.'
    if (termForm.startDate && termForm.endDate && termForm.endDate <= termForm.startDate) {
      errors.endDate = 'The end date must be after the start date.'
    }
    if (termForm.schoolDays !== '' && (!/^\d+$/.test(termForm.schoolDays) || Number(termForm.schoolDays) > 366)) {
      errors.schoolDays = 'School days must be a whole number up to 366.'
    }
    if (Object.keys(errors).length > 0) {
      setTermErrors(errors)
      return
    }

    setBusyAction('term')
    try {
      if (editingTerm) {
        const updated = await api.updateTerm(editingTerm.id, {
          name: termForm.name.trim(),
          termNumber,
          startDate: termForm.startDate,
          endDate: termForm.endDate,
          schoolDays: termForm.schoolDays === '' ? undefined : Number(termForm.schoolDays),
        })
        setTerms((current) => (current ?? []).map((entry) => (entry.id === updated.id ? updated : entry)))
        push('success', `${updated.name} updated.`)
      } else {
        const created = await api.createTerm({
          sessionId: termForm.sessionId,
          name: termForm.name.trim(),
          termNumber,
          startDate: termForm.startDate,
          endDate: termForm.endDate,
          schoolDays: termForm.schoolDays === '' ? undefined : Number(termForm.schoolDays),
        })
        setTerms((current) => (current ? [...current, created] : [created]))
        push('success', `${created.name} created.`)
      }
      setTermModal(false)
    } catch (err) {
      const apiError = err as { fieldErrors?: Record<string, string> }
      if (apiError.fieldErrors && Object.keys(apiError.fieldErrors).length > 0) {
        setTermErrors(apiError.fieldErrors)
      } else {
        push('error', err instanceof Error ? err.message : 'Could not save the term.')
      }
    } finally {
      setBusyAction(null)
    }
  }

  const handleToggleStatus = async () => {
    if (!confirm) return
    const { kind, record, status } = confirm
    setBusyAction('status')
    try {
      if (kind === 'session') {
        const updated = await api.setSessionStatus(record.id, status)
        setSessions((current) => (current ?? []).map((entry) => (entry.id === updated.id ? updated : entry)))
        push('success', `${updated.name} ${status === 'ACTIVE' ? 'activated' : 'deactivated'}.`)
      } else {
        const updated = await api.setTermStatus(record.id, status)
        setTerms((current) => (current ?? []).map((entry) => (entry.id === updated.id ? updated : entry)))
        push('success', `${updated.name} ${status === 'ACTIVE' ? 'activated' : 'deactivated'}.`)
      }
    } catch (err) {
      push('error', err instanceof Error ? err.message : 'Could not update the record.')
    } finally {
      setBusyAction(null)
      setConfirm(null)
    }
  }

  const activeSessionCount = sessions?.filter((session) => session.status === 'ACTIVE').length ?? 0
  const activeTermCount = terms?.filter((term) => term.status === 'ACTIVE').length ?? 0
  const sessionOptions = (sessions ?? []).map((session) => ({ value: session.id, label: session.name }))

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Academic Administration"
        title="Sessions & Terms"
        description="Academic sessions and their terms. Session and term records are managed by academic administration."
        actions={
          canManage ? (
            <>
              <Button variant="soft" onClick={openCreateTerm}>
                <Plus className="h-4 w-4" aria-hidden="true" />
                Add Term
              </Button>
              <Button onClick={openCreateSession}>
                <Plus className="h-4 w-4" aria-hidden="true" />
                Add Session
              </Button>
            </>
          ) : undefined
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {sessions ? (
          <>
            <StatCard
              label="Total Sessions"
              value={sessions.length}
              hint={`${activeSessionCount} active`}
              icon={<CalendarDays className="h-5 w-5" aria-hidden="true" />}
              tone="royal"
            />
            <StatCard
              label="Active Sessions"
              value={activeSessionCount}
              hint="Currently running"
              icon={<CalendarDays className="h-5 w-5" aria-hidden="true" />}
              tone="magenta"
            />
            <StatCard
              label="Total Terms"
              value={terms?.length ?? 0}
              hint={`${activeTermCount} active`}
              icon={<BookOpenCheck className="h-5 w-5" aria-hidden="true" />}
              tone="gold"
            />
            <StatCard
              label="Active Terms"
              value={activeTermCount}
              hint="Chargeable term"
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
      ) : sessions === null ? (
        <TableSkeleton rows={5} />
      ) : sessions.length === 0 ? (
        <EmptyState
          icon={<CalendarDays className="h-7 w-7" aria-hidden="true" />}
          title="No academic sessions have been created yet."
          description="Sessions and terms are created by academic administration."
        />
      ) : (
        <Card className="hidden overflow-hidden md:block">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-cream-200 bg-cream-50 text-xs font-bold uppercase tracking-wider text-ink-500">
                <tr>
                  <th scope="col" className="px-5 py-3.5">Session</th>
                  <th scope="col" className="px-5 py-3.5">Dates</th>
                  <th scope="col" className="px-5 py-3.5">Terms</th>
                  <th scope="col" className="px-5 py-3.5">Fee Structures</th>
                  <th scope="col" className="px-5 py-3.5">Status</th>
                  {canManage ? <th scope="col" className="px-5 py-3.5 text-right">Action</th> : null}
                </tr>
              </thead>
              <tbody className="divide-y divide-cream-200">
                {sessions.map((session) => (
                  <tr key={session.id} className="transition-colors hover:bg-cream-50">
                    <td className="px-5 py-3.5 font-bold text-ink-900">{session.name}</td>
                    <td className="px-5 py-3.5 text-ink-700">
                      {formatDate(session.startDate)} — {formatDate(session.endDate)}
                    </td>
                    <td className="px-5 py-3.5 text-ink-700">{session.termCount}</td>
                    <td className="px-5 py-3.5 text-ink-700">{session.feeCount}</td>
                    <td className="px-5 py-3.5"><StatusBadge status={session.status} /></td>
                    {canManage ? (
                      <td className="px-5 py-3.5">
                        <div className="flex justify-end gap-2">
                          <Button variant="soft" size="sm" onClick={() => openEditSession(session)}>
                            <Pencil className="h-4 w-4" aria-hidden="true" />
                            Edit
                          </Button>
                          <Button
                            variant="soft"
                            size="sm"
                            onClick={() =>
                              setConfirm({
                                kind: 'session',
                                record: session,
                                status: session.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE',
                              })
                            }
                          >
                            {session.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}
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

      {/* Mobile sessions */}
      {sessions && sessions.length > 0 ? (
        <ul className="space-y-3 md:hidden">
          {sessions.map((session) => (
            <li key={session.id}>
              <Card className="p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-ink-900">{session.name}</p>
                    <p className="text-xs text-ink-500">
                      {session.termCount} term(s) · {session.feeCount} fee structure(s)
                    </p>
                  </div>
                  <StatusBadge status={session.status} />
                </div>
                {canManage ? (
                  <div className="mt-3 flex flex-wrap justify-end gap-2 border-t border-cream-200 pt-3">
                    <Button variant="soft" size="sm" onClick={() => openEditSession(session)}>
                      <Pencil className="h-4 w-4" aria-hidden="true" />
                      Edit
                    </Button>
                    <Button
                      variant="soft"
                      size="sm"
                      onClick={() =>
                        setConfirm({
                          kind: 'session',
                          record: session,
                          status: session.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE',
                        })
                      }
                    >
                      {session.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}
                    </Button>
                  </div>
                ) : null}
              </Card>
            </li>
          ))}
        </ul>
      ) : null}

      {/* Terms */}
      <Card className="p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold uppercase tracking-wider text-ink-500">Terms</h2>
          <span className="text-xs text-ink-500">{terms?.length ?? 0} term(s)</span>
        </div>
        <div className="mt-4">
          {terms === null ? (
            <TableSkeleton rows={3} />
          ) : terms.length === 0 ? (
            <EmptyState title="No terms have been created yet." description="Terms belong to academic sessions." />
          ) : (
            <ul className="space-y-3">
              {terms.map((term) => {
                const session = sessions?.find((entry) => entry.id === term.sessionId)
                return (
                  <li key={term.id}>
                    <div className="rounded-xl border border-cream-200 bg-cream-50 p-4">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-sm font-bold text-ink-900">{term.name}</p>
                            <StatusBadge status={term.status} />
                          </div>
                          <p className="mt-1 text-xs text-ink-500">
                            {session?.name ?? 'Unknown session'} · Term {term.termNumber} ·{' '}
                            {term.schoolDays} school day(s)
                          </p>
                          <p className="mt-0.5 text-xs text-ink-500">
                            {formatDate(term.startDate)} — {formatDate(term.endDate)}
                          </p>
                        </div>
                        {canManage ? (
                          <div className="flex flex-wrap gap-2">
                            <Button variant="soft" size="sm" onClick={() => openEditTerm(term)}>
                              <Pencil className="h-4 w-4" aria-hidden="true" />
                              Edit
                            </Button>
                            <Button
                              variant="soft"
                              size="sm"
                              onClick={() =>
                                setConfirm({
                                  kind: 'term',
                                  record: term,
                                  status: term.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE',
                                })
                              }
                            >
                              {term.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}
                            </Button>
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </Card>

      {/* Session modal */}
      <Modal
        open={sessionModal}
        onClose={() => setSessionModal(false)}
        title={editingSession ? 'Edit session' : 'Add session'}
        description={
          editingSession ? `Update the details of ${editingSession.name}.` : 'Create an academic session.'
        }
        size="lg"
      >
        <form onSubmit={handleSessionSubmit} noValidate className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <TextField
              label="Session name"
              name="name"
              value={sessionForm.name}
              onChange={(event) => setSessionField('name', event.target.value)}
              error={sessionErrors.name}
              hint="e.g. 2026/2027 Academic Session."
              required
              autoComplete="off"
            />
          </div>
          <TextField
            label="Start date"
            name="startDate"
            type="date"
            value={sessionForm.startDate}
            onChange={(event) => setSessionField('startDate', event.target.value)}
            error={sessionErrors.startDate}
            required
          />
          <TextField
            label="End date"
            name="endDate"
            type="date"
            value={sessionForm.endDate}
            onChange={(event) => setSessionField('endDate', event.target.value)}
            error={sessionErrors.endDate}
            required
          />
          <div className="flex items-center justify-end gap-2 sm:col-span-2">
            <Button variant="cream" type="button" onClick={() => setSessionModal(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={busyAction === 'session'}>
              {busyAction === 'session' ? <Spinner className="h-4 w-4" /> : null}
              {editingSession ? 'Save changes' : 'Create session'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Term modal */}
      <Modal
        open={termModal}
        onClose={() => setTermModal(false)}
        title={editingTerm ? 'Edit term' : 'Add term'}
        description={
          editingTerm ? `Update the details of ${editingTerm.name}.` : 'Create a term within an academic session.'
        }
        size="lg"
      >
        <form onSubmit={handleTermSubmit} noValidate className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <SelectField
              label="Session"
              name="sessionId"
              value={termForm.sessionId}
              onChange={(event) => setTermField('sessionId', event.target.value)}
              options={sessionOptions}
              placeholder={sessionOptions.length > 0 ? 'Select a session' : 'No sessions available yet'}
              error={termErrors.sessionId}
              required
            />
          </div>
          <TextField
            label="Term name"
            name="name"
            value={termForm.name}
            onChange={(event) => setTermField('name', event.target.value)}
            error={termErrors.name}
            hint="e.g. First Term."
            required
            autoComplete="off"
          />
          <TextField
            label="Term number"
            name="termNumber"
            inputMode="numeric"
            value={termForm.termNumber}
            onChange={(event) => setTermField('termNumber', event.target.value)}
            error={termErrors.termNumber}
            required
          />
          <TextField
            label="Start date"
            name="startDate"
            type="date"
            value={termForm.startDate}
            onChange={(event) => setTermField('startDate', event.target.value)}
            error={termErrors.startDate}
            required
          />
          <TextField
            label="End date"
            name="endDate"
            type="date"
            value={termForm.endDate}
            onChange={(event) => setTermField('endDate', event.target.value)}
            error={termErrors.endDate}
            required
          />
          <div className="sm:col-span-2">
            <TextField
              label="School days"
              name="schoolDays"
              inputMode="numeric"
              value={termForm.schoolDays}
              onChange={(event) => setTermField('schoolDays', event.target.value)}
              error={termErrors.schoolDays}
              hint="Number of school days in this term. Optional; defaults to 0."
            />
          </div>
          <div className="flex items-center justify-end gap-2 sm:col-span-2">
            <Button variant="cream" type="button" onClick={() => setTermModal(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={busyAction === 'term'}>
              {busyAction === 'term' ? <Spinner className="h-4 w-4" /> : null}
              {editingTerm ? 'Save changes' : 'Create term'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Status confirm */}
      {confirm ? (
        <ConfirmDialog
          open
          title={`${confirm.status === 'ACTIVE' ? 'Activate' : 'Deactivate'} ${
            confirm.kind === 'session' ? 'session' : 'term'
          }`}
          message={
            confirm.status === 'ACTIVE'
              ? `Activating ${confirm.record.name} makes it available for fee structures and charges.`
              : `Deactivating ${confirm.record.name} stops new fee structures and charges from being attached. Existing records are kept.`
          }
          confirmLabel={confirm.status === 'ACTIVE' ? 'Activate' : 'Deactivate'}
          loading={busyAction === 'status'}
          onConfirm={() => void handleToggleStatus()}
          onCancel={() => setConfirm(null)}
        />
      ) : null}
    </div>
  )
}