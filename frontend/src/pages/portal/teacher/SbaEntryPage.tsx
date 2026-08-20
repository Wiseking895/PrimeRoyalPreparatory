import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ClipboardList, Lock, Save } from 'lucide-react'
import { PageHeader } from '@/components/dashboard/PageHeader'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/dashboard/Badge'
import { CardSkeleton } from '@/components/dashboard/Loaders'
import { ErrorState, EmptyState } from '@/components/dashboard/States'
import { SelectField, TextField } from '@/components/dashboard/Field'
import { useToast } from '@/components/dashboard/Toast'
import { api } from '@/lib/api'
import type { AcademicTermView, SbaEntryDataView } from '@/types/portal'

interface ScoreDraft {
  score: string
  maxScore: string
  comment: string
}

const EMPTY_DRAFT: ScoreDraft = { score: '', maxScore: '', comment: '' }

function normalizeMaxScore(maxScore: string): string {
  const value = Number(maxScore)
  if (!Number.isFinite(value) || value <= 0) return '100'
  return String(Math.min(999.99, value))
}

export function SbaEntryPage() {
  const { push } = useToast()
  const [terms, setTerms] = useState<AcademicTermView[]>([])
  const [assignments, setAssignments] = useState<
    Array<{ subjectId: string; subjectName: string; subjectCode: string; classId: string; className: string }>
  >([])
  const [termId, setTermId] = useState('')
  const [comboKey, setComboKey] = useState('')
  const [entry, setEntry] = useState<SbaEntryDataView | null>(null)
  const [drafts, setDrafts] = useState<Record<string, ScoreDraft>>({})
  const [saving, setSaving] = useState(false)
  const [loadingOptions, setLoadingOptions] = useState(true)
  const [loadingEntry, setLoadingEntry] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const entryRequest = useRef(0)

  const loadOptions = useCallback(async () => {
    setLoadingOptions(true)
    try {
      const [portal, sessionData] = await Promise.all([api.academicMe(), api.listSessions()])
      setAssignments(
        portal.teachingAssignments
          .filter((assignment) => assignment.status === 'ACTIVE')
          .map((assignment) => ({
            subjectId: assignment.subjectId,
            subjectName: assignment.subjectName,
            subjectCode: assignment.subjectCode,
            classId: assignment.classId,
            className: assignment.className,
          })),
      )
      const activeSession = sessionData.find((session) => session.status === 'ACTIVE') ?? sessionData[0]
      if (activeSession) {
        const termData = await api.listTerms(activeSession.id)
        setTerms(termData)
        const activeTerm = termData.find((term) => term.status === 'ACTIVE') ?? termData[0]
        setTermId(activeTerm?.id ?? '')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load your assignments.')
    } finally {
      setLoadingOptions(false)
    }
  }, [])

  useEffect(() => {
    void loadOptions()
  }, [loadOptions])

  const comboOptions = useMemo(() => {
    const seen = new Set<string>()
    const options: Array<{ value: string; label: string }> = []
    for (const assignment of assignments) {
      const key = `${assignment.subjectId}|${assignment.classId}`
      if (seen.has(key)) continue
      seen.add(key)
      options.push({
        value: key,
        label: `${assignment.subjectName} — ${assignment.className}`,
      })
    }
    return options
  }, [assignments])

  const loadEntry = useCallback(
    async (selectedCombo: string, selectedTerm: string) => {
      const [subjectId, classId] = selectedCombo.split('|')
      if (!subjectId || !classId || !selectedTerm) {
        setEntry(null)
        setDrafts({})
        return
      }
      const requestId = ++entryRequest.current
      setLoadingEntry(true)
      setError(null)
      try {
        const data = await api.sbaEntryData({ classId, subjectId, termId: selectedTerm })
        if (requestId !== entryRequest.current) return
        setEntry(data)
        const nextDrafts: Record<string, ScoreDraft> = {}
        for (const pupil of data.pupils) {
          nextDrafts[pupil.id] = pupil.record
            ? { score: pupil.record.score, maxScore: pupil.record.maxScore, comment: pupil.record.comment ?? '' }
            : { ...EMPTY_DRAFT, maxScore: '100' }
        }
        setDrafts(nextDrafts)
      } catch (err) {
        if (requestId === entryRequest.current) {
          setError(err instanceof Error ? err.message : 'Could not load scores for this class.')
        }
      } finally {
        if (requestId === entryRequest.current) setLoadingEntry(false)
      }
    },
    [],
  )

  useEffect(() => {
    if (comboKey && termId) void loadEntry(comboKey, termId)
  }, [comboKey, termId, loadEntry])

  const updateDraft = useCallback((pupilId: string, field: keyof ScoreDraft, value: string) => {
    setDrafts((current) => ({ ...current, [pupilId]: { ...(current[pupilId] ?? EMPTY_DRAFT), [field]: value } }))
  }, [])

  const handleSave = async () => {
    if (!entry || !comboKey || !termId) return
    const [subjectId, classId] = comboKey.split('|')
    const pupilIds = entry.pupils.map((pupil) => pupil.id)
    const entries = pupilIds
      .map((pupilId) => {
        const draft = drafts[pupilId] ?? EMPTY_DRAFT
        const score = Number(draft.score)
        const maxScore = Number(draft.maxScore)
        if (!Number.isFinite(score)) return null
        if (score > maxScore) {
          push('error', `Score for ${entry.pupils.find((p) => p.id === pupilId)?.fullName ?? 'a pupil'} exceeds its maximum.`)
          return null
        }
        return {
          pupilId,
          score,
          maxScore,
          comment: draft.comment.trim() || null,
        }
      })
      .filter((item): item is NonNullable<typeof item> => item !== null)

    if (entries.length === 0) {
      push('error', 'Enter at least one valid score.')
      return
    }

    setSaving(true)
    try {
      await api.sbaBulk({ subjectId, classId, termId, entries })
      push('success', `${entries.length} score(s) saved.`)
      await loadEntry(comboKey, termId)
    } catch (err) {
      push('error', err instanceof Error ? err.message : 'Could not save scores.')
    } finally {
      setSaving(false)
    }
  }

  if (loadingOptions) {
    return (
      <div className="space-y-6">
        <PageHeader eyebrow="Enter Scores" title="SBA Score Entry" description="Record school-based assessment scores." />
        <CardSkeleton />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Enter Scores"
        title="SBA Score Entry"
        description="Select a class and subject you teach, then enter or update assessment scores for the term."
      />

      {assignments.length === 0 ? (
        <EmptyState
          icon={<ClipboardList className="h-7 w-7" aria-hidden="true" />}
          title="No teaching assignments yet."
          description="You can enter assessment scores once the school assigns you subjects and classes."
        />
      ) : (
        <>
          <Card className="p-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <SelectField
                label="Class & Subject"
                name="combo"
                placeholder="Select a class and subject"
                value={comboKey}
                onChange={(event) => setComboKey(event.target.value)}
                options={comboOptions}
              />
              <SelectField
                label="Term"
                name="term"
                placeholder="Select a term"
                value={termId}
                onChange={(event) => setTermId(event.target.value)}
                options={terms.map((term) => ({ value: term.id, label: term.name }))}
              />
              <div className="flex items-end pb-1">
                {entry ? (
                  <Badge tone={entry.access === 'manage' ? 'green' : 'amber'}>
                    {entry.access === 'manage' ? 'You can edit these scores' : 'Read-only — you are not assigned here'}
                  </Badge>
                ) : null}
              </div>
            </div>
          </Card>

          {error ? (
            <ErrorState message={error} onRetry={() => comboKey && termId && void loadEntry(comboKey, termId)} />
          ) : loadingEntry || entry === null ? (
            <CardSkeleton />
          ) : (
            <Card className="overflow-hidden">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-cream-200 px-4 py-3">
                <div>
                  <p className="text-sm font-bold text-ink-900">
                    {entry.subject.name} — {entry.class.name}
                  </p>
                  <p className="text-xs text-ink-500">
                    {entry.term.name} · {entry.term.sessionName} · {entry.pupils.length} active pupil(s)
                  </p>
                </div>
                {entry.access === 'manage' ? (
                  <button
                    type="button"
                    onClick={() => void handleSave()}
                    disabled={saving}
                    className="inline-flex items-center gap-2 rounded-full bg-magenta-500 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-magenta-600 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Save className="h-4 w-4" aria-hidden="true" />
                    {saving ? 'Saving…' : 'Save scores'}
                  </button>
                ) : (
                  <Badge tone="amber">
                    <Lock className="h-3 w-3" aria-hidden="true" />
                    View only
                  </Badge>
                )}
              </div>
              {entry.pupils.length === 0 ? (
                <div className="p-6">
                  <EmptyState
                    title="No active pupils in this class."
                    description="Scores can be entered once pupils are enrolled and active in this class."
                  />
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-cream-50 text-xs uppercase tracking-wider text-ink-500">
                      <tr>
                        <th scope="col" className="px-4 py-3 font-semibold">Pupil</th>
                        <th scope="col" className="w-32 px-4 py-3 font-semibold">Score</th>
                        <th scope="col" className="w-32 px-4 py-3 font-semibold">Max</th>
                        <th scope="col" className="px-4 py-3 font-semibold">Comment</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-cream-100">
                      {entry.pupils.map((pupil) => {
                        const draft = drafts[pupil.id] ?? EMPTY_DRAFT
                        return (
                          <tr key={pupil.id} className="align-middle">
                            <td className="px-4 py-3">
                              <p className="font-bold text-ink-900">{pupil.fullName}</p>
                              <p className="text-xs text-ink-500">{pupil.pupilId}</p>
                            </td>
                            <td className="px-4 py-3">
                              <TextField
                                label="Score"
                                name={`score-${pupil.id}`}
                                type="number"
                                step="0.01"
                                min="0"
                                max={normalizeMaxScore(draft.maxScore)}
                                value={draft.score}
                                disabled={entry.access !== 'manage'}
                                onChange={(event) => updateDraft(pupil.id, 'score', event.target.value)}
                                className="min-w-24 py-2"
                              />
                            </td>
                            <td className="px-4 py-3">
                              <TextField
                                label="Max"
                                name={`max-${pupil.id}`}
                                type="number"
                                step="0.01"
                                min="0.01"
                                max="999.99"
                                value={draft.maxScore}
                                disabled={entry.access !== 'manage'}
                                onChange={(event) => updateDraft(pupil.id, 'maxScore', event.target.value)}
                                className="min-w-24 py-2"
                              />
                            </td>
                            <td className="px-4 py-3">
                              <TextField
                                label="Comment"
                                name={`comment-${pupil.id}`}
                                value={draft.comment}
                                disabled={entry.access !== 'manage'}
                                onChange={(event) => updateDraft(pupil.id, 'comment', event.target.value)}
                                className="min-w-48 py-2"
                              />
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          )}
        </>
      )}
    </div>
  )
}