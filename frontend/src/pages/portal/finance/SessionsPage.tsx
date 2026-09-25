import { useCallback, useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import {
  AlertTriangle,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Download,
  Pencil,
  Plus,
  RotateCcw,
} from 'lucide-react'
import { useAuth } from '@/auth/AuthContext'
import { PageHeader } from '@/components/dashboard/PageHeader'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Badge, StatusBadge } from '@/components/dashboard/Badge'
import { ConfirmDialog } from '@/components/dashboard/ConfirmDialog'
import { Modal } from '@/components/dashboard/Modal'
import { TextField, SelectField } from '@/components/dashboard/Field'
import { Spinner, CardSkeleton, TableSkeleton } from '@/components/dashboard/Loaders'
import { EmptyState, ErrorState } from '@/components/dashboard/States'
import { useToast } from '@/components/dashboard/Toast'
import { api } from '@/lib/api'
import { formatDate } from '@/lib/date'
import { toDateInputValue } from '@/lib/dateInput'
import type { AcademicSessionView, AcademicTermView, AccountStatusValue, FeeView } from '@/types/portal'

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

/** One of the three standard PRPS term slots configured inside the academic-year workflow. */
interface TermSlot {
  termNumber: number
  name: string
  startDate: string
  endDate: string
  existingId: string | null
}

const emptySessionForm: SessionForm = { name: '', startDate: '', endDate: '' }
const emptyTermForm: TermForm = { sessionId: '', name: '', termNumber: '', startDate: '', endDate: '', schoolDays: '' }

const TERM_SLOT_DEFS = [
  { termNumber: 1, name: 'First Term' },
  { termNumber: 2, name: 'Second Term' },
  { termNumber: 3, name: 'Third Term' },
] as const

const PAGE_SIZE = 10

type SortValue = 'newest' | 'oldest'

type ConfirmState =
  | { kind: 'session'; record: AcademicSessionView; status: AccountStatusValue }
  | { kind: 'term'; record: AcademicTermView; status: AccountStatusValue }
  | null

function buildTermSlots(sessionId: string | null, terms: AcademicTermView[]): TermSlot[] {
  return TERM_SLOT_DEFS.map((def) => {
    const existing = sessionId
      ? terms.find((term) => term.sessionId === sessionId && term.termNumber === def.termNumber)
      : undefined
    return {
      termNumber: def.termNumber,
      name: existing?.name ?? def.name,
      startDate: existing ? toDateInputValue(existing.startDate) : '',
      endDate: existing ? toDateInputValue(existing.endDate) : '',
      existingId: existing?.id ?? null,
    }
  })
}

function rangesOverlap(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean {
  return aStart <= bEnd && aEnd >= bStart
}

function csvCell(value: string | number): string {
  return `"${String(value).replace(/"/g, '""')}"`
}

export function SessionsPage() {
  const { push } = useToast()
  const { hasPermission } = useAuth()

  const canManage = hasPermission('academic.manage')
  const canViewFees = hasPermission('finance.view')

  const [sessions, setSessions] = useState<AcademicSessionView[] | null>(null)
  const [terms, setTerms] = useState<AcademicTermView[] | null>(null)
  const [fees, setFees] = useState<FeeView[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [sort, setSort] = useState<SortValue>('newest')
  const [page, setPage] = useState(0)

  const [sessionModal, setSessionModal] = useState(false)
  const [editingSession, setEditingSession] = useState<AcademicSessionView | null>(null)
  const [sessionForm, setSessionForm] = useState<SessionForm>(emptySessionForm)
  const [termSlots, setTermSlots] = useState<TermSlot[]>([])
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
      setError(err instanceof Error ? err.message : 'Could not load academic years and terms.')
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (!canViewFees) return
    let cancelled = false
    api
      .listFees()
      .then((data) => {
        if (!cancelled) setFees(data)
      })
      .catch(() => {
        if (!cancelled) setFees(null)
      })
    return () => {
      cancelled = true
    }
  }, [canViewFees])

  const activeSessions = useMemo(() => (sessions ?? []).filter((session) => session.status === 'ACTIVE'), [sessions])
  const activeTermCount = useMemo(
    () => (terms ?? []).filter((term) => term.status === 'ACTIVE').length,
    [terms],
  )
  const currentSession = activeSessions[0] ?? null
  const currentTerm = useMemo(() => {
    if (!currentSession) return null
    return (
      (terms ?? []).find((term) => term.sessionId === currentSession.id && term.status === 'ACTIVE') ?? null
    )
  }, [terms, currentSession])
  const lastUpdated = useMemo(() => {
    const stamps = (sessions ?? []).map((session) => session.updatedAt).filter(Boolean).sort()
    return stamps.length > 0 ? stamps[stamps.length - 1] : null
  }, [sessions])

  const termsBySession = useMemo(() => {
    const map = new Map<string, AcademicTermView[]>()
    for (const term of terms ?? []) {
      const list = map.get(term.sessionId) ?? []
      list.push(term)
      map.set(term.sessionId, list)
    }
    for (const list of map.values()) {
      list.sort((a, b) => a.termNumber - b.termNumber)
    }
    return map
  }, [terms])

  const feesBySession = useMemo(() => {
    const map = new Map<string, FeeView[]>()
    if (!fees) return map
    for (const fee of fees) {
      const list = map.get(fee.sessionId) ?? []
      list.push(fee)
      map.set(fee.sessionId, list)
    }
    return map
  }, [fees])

  const visibleSessions = useMemo(() => {
    const query = search.trim().toLowerCase()
    const filtered = (sessions ?? []).filter((session) => {
      if (query && !session.name.toLowerCase().includes(query)) return false
      if (statusFilter && session.status !== statusFilter) return false
      return true
    })
    const sorted = [...filtered].sort((a, b) => {
      const byStart = b.startDate.localeCompare(a.startDate)
      if (byStart !== 0) return byStart
      return b.createdAt.localeCompare(a.createdAt)
    })
    return sort === 'oldest' ? sorted.reverse() : sorted
  }, [sessions, search, statusFilter, sort])

  const totalPages = Math.max(1, Math.ceil(visibleSessions.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages - 1)
  const pageRows = visibleSessions.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE)

  useEffect(() => {
    setPage(0)
  }, [search, statusFilter, sort])

  const showingLabel =
    visibleSessions.length === 0
      ? 'Showing 0 of 0 academic years'
      : totalPages === 1
        ? `Showing ${visibleSessions.length} of ${visibleSessions.length} academic years`
        : `Showing ${safePage * PAGE_SIZE + 1}–${Math.min((safePage + 1) * PAGE_SIZE, visibleSessions.length)} of ${visibleSessions.length} academic years`

  const openCreateSession = () => {
    setEditingSession(null)
    setSessionForm(emptySessionForm)
    setTermSlots(buildTermSlots(null, terms ?? []))
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
    setTermSlots(buildTermSlots(session.id, terms ?? []))
    setSessionErrors({})
    setSessionModal(true)
  }

  const openCreateTerm = (sessionId?: string) => {
    setEditingTerm(null)
    setTermForm({
      ...emptyTermForm,
      sessionId: sessionId ?? currentSession?.id ?? '',
    })
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

  const setSlotField = (termNumber: number, field: 'startDate' | 'endDate', value: string) => {
    setTermSlots((current) =>
      current.map((slot) => (slot.termNumber === termNumber ? { ...slot, [field]: value } : slot)),
    )
    setSessionErrors((current) => {
      const key = `term_${termNumber}_${field}`
      if (!current[key]) return current
      const next = { ...current }
      delete next[key]
      return next
    })
  }

  const validateSessionForm = (): Record<string, string> => {
    const errors: Record<string, string> = {}
    if (sessionForm.name.trim().length < 2) errors.name = 'Academic year name must be at least 2 characters.'
    if (!sessionForm.startDate) errors.startDate = 'Start date is required.'
    if (!sessionForm.endDate) errors.endDate = 'End date is required.'
    if (sessionForm.startDate && sessionForm.endDate && sessionForm.endDate <= sessionForm.startDate) {
      errors.endDate = 'The end date must be after the start date.'
    }

    const filled = termSlots.filter((slot) => slot.startDate || slot.endDate)
    for (const slot of filled) {
      if (!slot.startDate) errors[`term_${slot.termNumber}_startDate`] = `${slot.name} needs a start date.`
      if (!slot.endDate) errors[`term_${slot.termNumber}_endDate`] = `${slot.name} needs an end date.`
      if (slot.startDate && slot.endDate && slot.endDate <= slot.startDate) {
        errors[`term_${slot.termNumber}_endDate`] = `${slot.name} must end after it starts.`
      }
    }

    for (let i = 0; i < filled.length; i += 1) {
      const a = filled[i]
      if (!a.startDate || !a.endDate) continue
      for (let j = i + 1; j < filled.length; j += 1) {
        const b = filled[j]
        if (!b.startDate || !b.endDate) continue
        if (rangesOverlap(a.startDate, a.endDate, b.startDate, b.endDate)) {
          errors[`term_${b.termNumber}_endDate`] = `${b.name} overlaps ${a.name} in the same academic year.`
        }
      }
    }

    const slotExistingIds = new Set(
      termSlots.map((slot) => slot.existingId).filter((id): id is string => Boolean(id)),
    )
    const knownTerms = editingSession ? (termsBySession.get(editingSession.id) ?? []) : []
    for (const slot of filled) {
      if (!slot.startDate || !slot.endDate) continue
      for (const existing of knownTerms) {
        if (slotExistingIds.has(existing.id)) continue
        if (rangesOverlap(slot.startDate, slot.endDate, toDateInputValue(existing.startDate), toDateInputValue(existing.endDate))) {
          errors[`term_${slot.termNumber}_endDate`] =
            `${slot.name} overlaps "${existing.name}" in the same academic year.`
        }
      }
    }

    return errors
  }

  const handleSessionSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const errors = validateSessionForm()
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

        const updatedTerms: AcademicTermView[] = []
        for (const slot of termSlots) {
          if (!slot.startDate || !slot.endDate) continue
          try {
            if (slot.existingId) {
              const existing = (terms ?? []).find((entry) => entry.id === slot.existingId)
              if (!existing) continue
              const patch: { startDate?: string; endDate?: string } = {}
              if (slot.startDate !== toDateInputValue(existing.startDate)) patch.startDate = slot.startDate
              if (slot.endDate !== toDateInputValue(existing.endDate)) patch.endDate = slot.endDate
              if (patch.startDate || patch.endDate) {
                const saved = await api.updateTerm(slot.existingId, patch)
                updatedTerms.push(saved)
              }
            } else {
              const saved = await api.createTerm({
                sessionId: updated.id,
                name: slot.name,
                termNumber: slot.termNumber,
                startDate: slot.startDate,
                endDate: slot.endDate,
              })
              updatedTerms.push(saved)
            }
          } catch (termErr) {
            push('error', termErr instanceof Error ? termErr.message : `Could not save ${slot.name}.`)
          }
        }
        if (updatedTerms.length > 0) {
          const savedIds = new Set(updatedTerms.map((entry) => entry.id))
          setTerms((current) =>
            (current ?? []).map((entry) => (savedIds.has(entry.id) ? (updatedTerms.find((u) => u.id === entry.id) ?? entry) : entry)),
          )
        }
        push('success', `${updated.name} updated.`)
      } else {
        const created = await api.createSession({
          name: sessionForm.name.trim(),
          startDate: sessionForm.startDate,
          endDate: sessionForm.endDate,
        })
        setSessions((current) => (current ? [...current, created] : [created]))

        const createdTerms: AcademicTermView[] = []
        for (const slot of termSlots) {
          if (!slot.startDate || !slot.endDate) continue
          try {
            const saved = await api.createTerm({
              sessionId: created.id,
              name: slot.name,
              termNumber: slot.termNumber,
              startDate: slot.startDate,
              endDate: slot.endDate,
            })
            createdTerms.push(saved)
          } catch (termErr) {
            push('error', termErr instanceof Error ? termErr.message : `Could not save ${slot.name}.`)
          }
        }
        if (createdTerms.length > 0) {
          setTerms((current) => (current ? [...current, ...createdTerms] : createdTerms))
        }
        push('success', `${created.name} created.`)
      }
      setSessionModal(false)
      void load()
    } catch (err) {
      const apiError = err as { fieldErrors?: Record<string, string> }
      if (apiError.fieldErrors && Object.keys(apiError.fieldErrors).length > 0) {
        setSessionErrors(apiError.fieldErrors)
      } else {
        push('error', err instanceof Error ? err.message : 'Could not save the academic year.')
      }
    } finally {
      setBusyAction(null)
    }
  }

  const handleTermSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const errors: Record<string, string> = {}
    if (!termForm.sessionId) errors.sessionId = 'Select an academic year.'
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
    if (!errors.startDate && !errors.endDate && !errors.sessionId) {
      const overlaps = (terms ?? []).some(
        (entry) =>
          entry.sessionId === termForm.sessionId &&
          entry.id !== editingTerm?.id &&
          rangesOverlap(termForm.startDate, termForm.endDate, toDateInputValue(entry.startDate), toDateInputValue(entry.endDate)),
      )
      if (overlaps) {
        errors.endDate = 'This term overlaps another term in the same academic year.'
      }
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
        void load()
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
        void load()
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

  const handleExport = () => {
    const header = [
      'Academic Year',
      'Academic Year Start',
      'Academic Year End',
      'Academic Year Status',
      'Term',
      'Term Number',
      'Term Start',
      'Term End',
      'School Days',
      'Term Status',
      'Fee Structures',
    ]
    const rows: string[][] = []
    for (const session of visibleSessions) {
      const yearTerms = termsBySession.get(session.id) ?? []
      const yearFees = feesBySession.get(session.id)
      const feeNames = yearFees ? yearFees.map((fee) => fee.name) : []
      const feeSummary = yearFees
        ? `${feeNames.length > 0 ? feeNames.join(' | ') : 'None'} (${session.feeCount} mapped)`
        : `${session.feeCount} mapped`
      const yearStart = session.startDate.split('T')[0]
      const yearEnd = session.endDate.split('T')[0]
      if (yearTerms.length === 0) {
        rows.push([session.name, yearStart, yearEnd, session.status, '', '', '', '', '', '', feeSummary])
        continue
      }
      for (const term of yearTerms) {
        rows.push([
          session.name,
          yearStart,
          yearEnd,
          session.status,
          term.name,
          String(term.termNumber),
          term.startDate.split('T')[0],
          term.endDate.split('T')[0],
          String(term.schoolDays),
          term.status,
          feeSummary,
        ])
      }
    }
    const csv = [header, ...rows].map((row) => row.map(csvCell).join(',')).join('\r\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'PRPS-Academic-Years.csv'
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
    push('success', `Exported ${visibleSessions.length} academic year(s).`)
  }

  const sessionOptions = (sessions ?? []).map((session) => ({ value: session.id, label: session.name }))

  const renderStatus = (status: AccountStatusValue) =>
    status === 'ACTIVE' ? (
      <StatusBadge status="ACTIVE" />
    ) : (
      <Badge tone="neutral">
        <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-ink-400" />
        Inactive
      </Badge>
    )

  const feeCell = (session: AcademicSessionView) => {
    const yearFees = feesBySession.get(session.id)
    if (!yearFees) {
      return <p className="text-sm text-ink-700">{session.feeCount} mapped</p>
    }
    const names = yearFees.map((fee) => fee.name)
    return (
      <>
        <p className="text-sm text-ink-700">
          {names.length > 0 ? `${names.slice(0, 3).join(' · ')}${names.length > 3 ? ` +${names.length - 3}` : ''}` : 'None yet'}
        </p>
        <p className="text-xs text-ink-500">{session.feeCount} mapped</p>
      </>
    )
  }

  const termCell = (session: AcademicSessionView) => {
    const yearTerms = termsBySession.get(session.id) ?? []
    if (yearTerms.length === 0) {
      return <p className="text-sm text-ink-500">No terms yet</p>
    }
    return (
      <div className="flex flex-wrap items-center gap-1.5">
        {yearTerms.map((term) =>
          canManage ? (
            <button
              key={term.id}
              type="button"
              title={`Edit ${term.name}`}
              onClick={() => openEditTerm(term)}
              className="rounded-full transition hover:opacity-75 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-magenta-500"
            >
              <Badge tone={term.status === 'ACTIVE' ? 'green' : 'neutral'}>{term.name}</Badge>
            </button>
          ) : (
            <Badge key={term.id} tone={term.status === 'ACTIVE' ? 'green' : 'neutral'}>
              {term.name}
            </Badge>
          ),
        )}
        <span className="text-xs text-ink-500">
          {yearTerms.length} term{yearTerms.length === 1 ? '' : 's'}
        </span>
      </div>
    )
  }

  const rowActions = (session: AcademicSessionView) => (
    <div className="flex flex-wrap justify-end gap-2">
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
        {session.status === 'ACTIVE' ? 'Deactivate' : (
          <>
            <RotateCcw className="h-4 w-4" aria-hidden="true" />
            Restore
          </>
        )}
      </Button>
      <Button variant="soft" size="sm" onClick={() => openCreateTerm(session.id)}>
        <Plus className="h-4 w-4" aria-hidden="true" />
        Add term
      </Button>
    </div>
  )

  const hasFilters = search.trim() !== '' || statusFilter !== ''

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumb={[{ label: 'Setup' }, { label: 'Academic Years & Terms' }]}
        title="Academic Years & Terms"
        description="Define the school teaching calendar, manage term dates, and control which academic year is currently active for PRPS."
        actions={
          <>
            <Button
              variant="outline"
              onClick={handleExport}
              disabled={!sessions || visibleSessions.length === 0}
            >
              <Download className="h-4 w-4" aria-hidden="true" />
              Export
            </Button>
            {canManage ? (
              <Button onClick={openCreateSession}>
                <Plus className="h-4 w-4" aria-hidden="true" />
                Add Academic Year
              </Button>
            ) : null}
          </>
        }
      />

      {/* Compact summary bar */}
      {error ? null : !sessions ? (
        <Card className="p-4">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <CardSkeleton key={index} className="h-16" />
            ))}
          </div>
        </Card>
      ) : (
        <Card className="overflow-hidden p-0">
          <div className="grid gap-px bg-cream-200 sm:grid-cols-2 xl:grid-cols-4">
            <div className="bg-white p-4">
              <p className="text-[11px] font-bold uppercase tracking-wider text-ink-500">Academic Years</p>
              <p className="mt-1 text-lg font-extrabold text-ink-900">
                {sessions.length} total / {activeSessions.length} active
              </p>
            </div>
            <div className="bg-white p-4">
              <p className="text-[11px] font-bold uppercase tracking-wider text-ink-500">Terms</p>
              <p className="mt-1 text-lg font-extrabold text-ink-900">
                {terms?.length ?? 0} total / {activeTermCount} active
              </p>
            </div>
            <div className="bg-white p-4">
              <p className="text-[11px] font-bold uppercase tracking-wider text-ink-500">Current</p>
              {currentSession ? (
                <>
                  <p className="mt-1 flex items-center gap-2 text-lg font-extrabold text-ink-900">
                    <span aria-hidden="true" className="h-2 w-2 rounded-full bg-emerald-500" />
                    {currentSession.name}
                  </p>
                  <p className="mt-0.5 text-xs text-ink-500">
                    {currentTerm
                      ? `${currentTerm.name} · ends ${formatDate(currentTerm.endDate)}`
                      : `${formatDate(currentSession.startDate)} — ${formatDate(currentSession.endDate)}`}
                  </p>
                </>
              ) : (
                <p className="mt-1 text-lg font-extrabold text-ink-400">No active academic year</p>
              )}
            </div>
            {lastUpdated ? (
              <div className="bg-white p-4">
                <p className="text-[11px] font-bold uppercase tracking-wider text-ink-500">Updated</p>
                <p className="mt-1 text-lg font-extrabold text-ink-900">{formatDate(lastUpdated)}</p>
              </div>
            ) : null}
          </div>
        </Card>
      )}

      {/* Toolbar */}
      {error ? null : (
        <Card className="p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
            <div className="lg:w-72">
              <TextField
                label="Search"
                name="sessionSearch"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Filter by academic year or code..."
                autoComplete="off"
              />
            </div>
            <div className="lg:w-44">
              <SelectField
                label="Status"
                name="statusFilter"
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
                options={[
                  { value: '', label: 'All' },
                  { value: 'ACTIVE', label: 'Active' },
                  { value: 'INACTIVE', label: 'Inactive' },
                ]}
              />
            </div>
            <div className="lg:w-48">
              <SelectField
                label="Sort"
                name="sessionSort"
                value={sort}
                onChange={(event) => setSort(event.target.value as SortValue)}
                options={[
                  { value: 'newest', label: 'Newest first' },
                  { value: 'oldest', label: 'Oldest first' },
                ]}
              />
            </div>
            <p className="text-xs text-ink-500 lg:pb-3">
              Tip: only one academic year can be Active at a time
            </p>
          </div>
        </Card>
      )}

      {/* Table */}
      {error ? (
        <ErrorState message={error} onRetry={() => void load()} />
      ) : sessions === null ? (
        <TableSkeleton rows={5} />
      ) : sessions.length === 0 ? (
        <EmptyState
          icon={<CalendarDays className="h-7 w-7" aria-hidden="true" />}
          title="No academic years have been configured yet."
          description="Create an academic year, set its term dates, and activate it to start configuring fees."
          action={
            canManage ? (
              <Button onClick={openCreateSession}>
                <Plus className="h-4 w-4" aria-hidden="true" />
                Add Academic Year
              </Button>
            ) : undefined
          }
        />
      ) : pageRows.length === 0 ? (
        <EmptyState
          icon={<CalendarDays className="h-7 w-7" aria-hidden="true" />}
          title="No academic years match your filters."
          description="Try a different search term or clear the filters."
          action={
            hasFilters ? (
              <Button
                variant="soft"
                onClick={() => {
                  setSearch('')
                  setStatusFilter('')
                }}
              >
                Clear filters
              </Button>
            ) : undefined
          }
        />
      ) : (
        <>
          <Card className="hidden overflow-hidden md:block">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-cream-200 bg-cream-50 text-xs font-bold uppercase tracking-wider text-ink-500">
                  <tr>
                    <th scope="col" className="px-5 py-3.5">Academic Year</th>
                    <th scope="col" className="px-5 py-3.5">Dates</th>
                    <th scope="col" className="px-5 py-3.5">Terms</th>
                    <th scope="col" className="px-5 py-3.5">Fee Structures</th>
                    <th scope="col" className="px-5 py-3.5">Status</th>
                    {canManage ? <th scope="col" className="px-5 py-3.5 text-right">Actions</th> : null}
                  </tr>
                </thead>
                <tbody className="divide-y divide-cream-200">
                  {pageRows.map((session) => (
                    <tr key={session.id} className="transition-colors hover:bg-cream-50">
                      <td className="px-5 py-3.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-bold text-ink-900">{session.name}</p>
                          {session.status === 'ACTIVE' ? <Badge tone="gold">Current</Badge> : null}
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-ink-700">
                        {formatDate(session.startDate)} — {formatDate(session.endDate)}
                      </td>
                      <td className="px-5 py-3.5">{termCell(session)}</td>
                      <td className="px-5 py-3.5">{feeCell(session)}</td>
                      <td className="px-5 py-3.5">{renderStatus(session.status)}</td>
                      {canManage ? <td className="px-5 py-3.5">{rowActions(session)}</td> : null}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Mobile cards */}
          <ul className="space-y-3 md:hidden">
            {pageRows.map((session) => (
              <li key={session.id}>
                <Card className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate text-sm font-bold text-ink-900">{session.name}</p>
                        {session.status === 'ACTIVE' ? <Badge tone="gold">Current</Badge> : null}
                      </div>
                      <p className="mt-1 text-xs text-ink-500">
                        {formatDate(session.startDate)} — {formatDate(session.endDate)}
                      </p>
                    </div>
                    {renderStatus(session.status)}
                  </div>
                  <div className="mt-3 space-y-2 border-t border-cream-200 pt-3">
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-wider text-ink-500">Terms</p>
                      <div className="mt-1">{termCell(session)}</div>
                    </div>
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-wider text-ink-500">Fee Structures</p>
                      <div className="mt-0.5">{feeCell(session)}</div>
                    </div>
                  </div>
                  {canManage ? (
                    <div className="mt-3 border-t border-cream-200 pt-3">{rowActions(session)}</div>
                  ) : null}
                </Card>
              </li>
            ))}
          </ul>

          {/* Pagination */}
          <div className="flex flex-col items-center justify-between gap-3 sm:flex-row">
            <p className="text-xs font-semibold text-ink-500">{showingLabel}</p>
            <div className="flex items-center gap-2">
              <Button
                variant="soft"
                size="sm"
                onClick={() => setPage((current) => Math.max(0, current - 1))}
                disabled={safePage === 0}
              >
                <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                Previous
              </Button>
              <span className="text-xs font-semibold text-ink-500">
                Page {safePage + 1} of {totalPages}
              </span>
              <Button
                variant="soft"
                size="sm"
                onClick={() => setPage((current) => Math.min(totalPages - 1, current + 1))}
                disabled={safePage >= totalPages - 1}
              >
                Next
                <ChevronRight className="h-4 w-4" aria-hidden="true" />
              </Button>
            </div>
          </div>
        </>
      )}

      {/* Contextual warning banner */}
      <div className="flex items-start gap-3 rounded-2xl border border-amber-300 bg-amber-50 p-4">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
          <AlertTriangle className="h-5 w-5" aria-hidden="true" />
        </span>
        <div>
          <p className="text-sm font-bold text-amber-800">
            Changing the active academic year affects admissions, charge generation, and payments.
          </p>
          <p className="mt-1 text-sm leading-relaxed text-amber-800/80">
            New admissions attach fee structures from the active academic year, charges auto-generate for it, and
            payments and reconciliation require an active academic year with an active term. Deactivating an academic
            year stops new fee structures and charges from being attached to it. Historical records remain linked to
            their original academic year and term.
          </p>
        </div>
      </div>

      {/* Academic year modal */}
      <Modal
        open={sessionModal}
        onClose={() => setSessionModal(false)}
        title={editingSession ? 'Edit academic year' : 'Add academic year'}
        description={
          editingSession
            ? `Update ${editingSession.name} and its term dates.`
            : 'Create an academic year and configure its term dates.'
        }
        size="lg"
      >
        <form onSubmit={handleSessionSubmit} noValidate className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <TextField
              label="Academic year name"
              name="name"
              value={sessionForm.name}
              onChange={(event) => setSessionField('name', event.target.value)}
              error={sessionErrors.name}
              hint="e.g. 2026/2027."
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

          <div className="rounded-xl border border-cream-200 bg-cream-50 p-4 sm:col-span-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-bold uppercase tracking-wider text-ink-500">Terms</p>
              <p className="text-xs text-ink-500">Optional. Leave a term blank to skip it.</p>
            </div>
            <div className="mt-3 space-y-4">
              {termSlots.map((slot) => (
                <div key={slot.termNumber}>
                  <p className="text-sm font-bold text-ink-900">{slot.name}</p>
                  <div className="mt-2 grid gap-3 sm:grid-cols-2">
                    <TextField
                      label={`${slot.name} start date`}
                      name={`term_${slot.termNumber}_startDate`}
                      type="date"
                      value={slot.startDate}
                      onChange={(event) => setSlotField(slot.termNumber, 'startDate', event.target.value)}
                      error={sessionErrors[`term_${slot.termNumber}_startDate`]}
                    />
                    <TextField
                      label={`${slot.name} end date`}
                      name={`term_${slot.termNumber}_endDate`}
                      type="date"
                      value={slot.endDate}
                      onChange={(event) => setSlotField(slot.termNumber, 'endDate', event.target.value)}
                      error={sessionErrors[`term_${slot.termNumber}_endDate`]}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 sm:col-span-2">
            <Button variant="cream" type="button" onClick={() => setSessionModal(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={busyAction === 'session'}>
              {busyAction === 'session' ? <Spinner className="h-4 w-4" /> : null}
              {editingSession ? 'Save changes' : 'Create academic year'}
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
          editingTerm ? `Update the details of ${editingTerm.name}.` : 'Create a term within an academic year.'
        }
        size="lg"
      >
        <form onSubmit={handleTermSubmit} noValidate className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <SelectField
              label="Academic Year"
              name="sessionId"
              value={termForm.sessionId}
              onChange={(event) => setTermField('sessionId', event.target.value)}
              options={sessionOptions}
              placeholder={sessionOptions.length > 0 ? 'Select an academic year' : 'No academic years available yet'}
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
              hint="Number of school days in this term. Optional; defaults to the weekday count."
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
            confirm.kind === 'session' ? 'academic year' : 'term'
          }`}
          message={
            confirm.kind === 'session'
              ? confirm.status === 'ACTIVE'
                ? `Activating ${confirm.record.name} makes it the only active academic year — the previously active academic year is archived automatically. New admissions, charges, and payments will then resolve against it.`
                : `Deactivating ${confirm.record.name} stops new fee structures, charges, and admissions from being attached to it. Existing records are kept and remain linked to this academic year.`
              : confirm.status === 'ACTIVE'
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
