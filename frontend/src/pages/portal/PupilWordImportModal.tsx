import { useMemo, useRef, useState } from 'react'
import type { ChangeEvent, DragEvent } from 'react'
import { FileDown, FileText, Upload } from 'lucide-react'
import { Badge } from '@/components/dashboard/Badge'
import { Modal } from '@/components/dashboard/Modal'
import { Spinner } from '@/components/dashboard/Loaders'
import { useToast } from '@/components/dashboard/Toast'
import { Button } from '@/components/ui/Button'
import { api } from '@/lib/api'
import type {
  PupilGender,
  PupilImportConfirmRow,
  PupilImportConfirmResult,
  PupilImportPreview,
  PupilImportPreviewRow,
  PupilImportRowStatus,
  SchoolClassView,
  UniformCollectionStatus,
} from '@/types/portal'

type Step = 'upload' | 'preview' | 'result'

/** One uniform slot being reviewed/corrected in the preview. */
interface RowUniformEdit {
  slot: number
  label: string
  status: UniformCollectionStatus
}

interface RowEdit {
  included: boolean
  /** The physical admission form has no gender field - corrected here. */
  gender: PupilGender | ''
  classId: string
  admissionNumber: string
  sheetNumber: string
  admissionFee: string
  uniforms: RowUniformEdit[]
}

const MAX_ADMISSION_NUMBER_LENGTH = 40
const MAX_SHEET_NUMBER_LENGTH = 40
const MAX_UNIFORM_LABEL_LENGTH = 80

const STATUS_TONE: Record<PupilImportRowStatus, 'green' | 'amber' | 'gold' | 'red'> = {
  VALID: 'green',
  WARNING: 'amber',
  DUPLICATE: 'gold',
  ERROR: 'red',
}

const STATUS_LABEL: Record<PupilImportRowStatus, string> = {
  VALID: 'Valid',
  WARNING: 'Warning',
  DUPLICATE: 'Duplicate',
  ERROR: 'Error',
}

function defaultIncluded(status: PupilImportRowStatus): boolean {
  return status === 'VALID' || status === 'WARNING'
}

/** Mirrors the backend admission-fee rule: empty, or plain decimal money. */
function isValidAdmissionFee(value: string): boolean {
  const trimmed = value.trim()
  return trimmed === '' || /^\d+(\.\d{1,2})?$/.test(trimmed)
}

function blankUniforms(): RowUniformEdit[] {
  return [1, 2, 3, 4, 5].map((slot) => ({ slot, label: '', status: 'NOT_COLLECTED' }))
}

function defaultRowEdit(row: PupilImportPreviewRow, included: boolean): RowEdit {
  const uniforms = row.data.uniforms
  return {
    included,
    gender: row.data.gender ?? '',
    classId: row.data.classId ?? '',
    admissionNumber: row.data.admissionNumber ?? '',
    sheetNumber: row.data.sheetNumber ?? '',
    admissionFee: row.data.admissionFee ?? '',
    uniforms:
      uniforms && uniforms.length > 0
        ? uniforms.map((item) => ({ slot: item.slot, label: item.label ?? '', status: item.status }))
        : blankUniforms(),
  }
}

function blankRowEdit(): RowEdit {
  return {
    included: false,
    gender: '',
    classId: '',
    admissionNumber: '',
    sheetNumber: '',
    admissionFee: '',
    uniforms: blankUniforms(),
  }
}

/**
 * True when the current preview edits resolve the given row message.
 * Mirrors the backend's correctable admission messages so the Headteacher can
 * fix admission number / sheet number / admission fee / uniform problems
 * before confirmation instead of editing the Word file.
 */
function messageFixed(message: string, edit: RowEdit): boolean {
  switch (message) {
    case 'Class not found':
    case 'Class is required.':
      return Boolean(edit.classId)
    case 'Gender is required.':
    case 'Gender must be Male or Female.':
      return Boolean(edit.gender)
    case 'Admission number is too long.':
      return edit.admissionNumber.trim().length <= MAX_ADMISSION_NUMBER_LENGTH
    case 'Sheet number is too long.':
      return edit.sheetNumber.trim().length <= MAX_SHEET_NUMBER_LENGTH
    case 'Admission fee is not a valid amount.':
      return isValidAdmissionFee(edit.admissionFee)
    case 'A uniform label is too long.':
      return edit.uniforms.every((item) => item.label.trim().length <= MAX_UNIFORM_LABEL_LENGTH)
    default:
      return false
  }
}

/** Row failed, but every failure is resolvable with the current edits. */
function isRowCorrected(row: PupilImportPreviewRow, edit: RowEdit): boolean {
  return (
    row.status === 'ERROR' &&
    row.messages.length > 0 &&
    row.messages.every((message) => messageFixed(message, edit))
  )
}

function correctedNote(
  row: PupilImportPreviewRow,
  edit: RowEdit,
  activeClasses: SchoolClassView[],
): string {
  const parts: string[] = []
  if (row.messages.some((m) => m === 'Class not found' || m === 'Class is required.')) {
    const className = activeClasses.find((klass) => klass.id === edit.classId)?.name
    parts.push(className ? `Class corrected to ${className}.` : 'Class corrected.')
  }
  if (row.messages.some((m) => m === 'Gender is required.' || m === 'Gender must be Male or Female.')) {
    parts.push(edit.gender === 'MALE' ? 'Gender corrected to Male.' : 'Gender corrected to Female.')
  }
  if (
    row.messages.some(
      (m) =>
        m === 'Admission number is too long.' ||
        m === 'Sheet number is too long.' ||
        m === 'Admission fee is not a valid amount.' ||
        m === 'A uniform label is too long.',
    )
  ) {
    parts.push('Admission details corrected.')
  }
  return parts.join(' ') || 'Corrected in preview.'
}

function toConfirmRow(row: PupilImportPreviewRow, edit: RowEdit): PupilImportConfirmRow | null {
  const { data } = row
  const gender = data.gender ?? edit.gender
  if (!data.dateOfBirth || !gender || !edit.classId) return null

  const toGuardian = (guardian: {
    fullName: string
    relationship: string | null
    phone: string | null
    address?: string | null
    occupation: string | null
    isPrimary?: boolean
    isEmergency?: boolean
  }) => ({
    fullName: guardian.fullName,
    relationship: guardian.relationship?.trim() || 'Guardian',
    phone: guardian.phone ?? undefined,
    address: guardian.address ?? undefined,
    occupation: guardian.occupation ?? undefined,
    isPrimary: guardian.isPrimary ?? true,
    isEmergency: guardian.isEmergency ?? true,
  })

  const guardians =
    data.guardians && data.guardians.length > 0
      ? data.guardians.map(toGuardian)
      : data.guardian
        ? [toGuardian(data.guardian)]
        : []

  return {
    rowNumber: row.rowNumber,
    firstName: data.firstName,
    middleName: data.middleName ?? undefined,
    lastName: data.lastName,
    dateOfBirth: data.dateOfBirth,
    gender,
    classId: edit.classId,
    admissionNumber: edit.admissionNumber.trim() || undefined,
    sheetNumber: edit.sheetNumber.trim() || undefined,
    admissionFee: edit.admissionFee.trim() || undefined,
    dateAdmitted: data.dateAdmitted ?? undefined,
    address: data.address ?? undefined,
    nationality: data.nationality ?? undefined,
    religion: data.religion ?? undefined,
    admissionReason: data.admissionReason ?? undefined,
    previousSchool: data.previousSchool ?? undefined,
    stayWithChild: data.stayWithChild ?? undefined,
    declarationAcknowledged: data.declarationAcknowledged ?? false,
    status: 'ACTIVE',
    uniforms: edit.uniforms.map((item) => ({
      slot: item.slot,
      label: item.label.trim() || null,
      status: item.status,
    })),
    guardians,
  }
}

interface PupilWordImportModalProps {
  open: boolean
  onClose: () => void
  onImported: () => void | Promise<void>
  classes: SchoolClassView[]
}

export function PupilWordImportModal({ open, onClose, onImported, classes }: PupilWordImportModalProps) {
  const { push } = useToast()
  const inputRef = useRef<HTMLInputElement>(null)

  const [step, setStep] = useState<Step>('upload')
  const [fileName, setFileName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [preview, setPreview] = useState<PupilImportPreview | null>(null)
  const [edits, setEdits] = useState<Record<number, RowEdit>>({})
  const [result, setResult] = useState<PupilImportConfirmResult | null>(null)
  const [dragging, setDragging] = useState(false)

  const activeClasses = useMemo(
    () => classes.filter((klass) => klass.status === 'ACTIVE'),
    [classes],
  )

  const selectedCount = useMemo(
    () => Object.values(edits).filter((edit) => edit.included).length,
    [edits],
  )

  const reset = () => {
    setStep('upload')
    setFileName('')
    setBusy(false)
    setError(null)
    setPreview(null)
    setEdits({})
    setResult(null)
    setDragging(false)
    if (inputRef.current) inputRef.current.value = ''
  }

  const handleClose = () => {
    if (busy) return
    reset()
    onClose()
  }

  const buildInitialEdits = (next: PupilImportPreview) => {
    const map: Record<number, RowEdit> = {}
    for (const row of next.rows) {
      map[row.rowNumber] = defaultRowEdit(
        row,
        defaultIncluded(row.status) && Boolean(row.data.classId),
      )
    }
    setEdits(map)
  }

  const runPreview = async (file: File) => {
    setError(null)
    if (!file.name.toLowerCase().endsWith('.docx')) {
      setError('Please choose a Word (.docx) document. Save older .doc files as .docx first.')
      return
    }
    setFileName(file.name)
    setBusy(true)
    try {
      const next = await api.previewPupilImport(file)
      setPreview(next)
      buildInitialEdits(next)
      setStep('preview')
      push('success', 'Document parsed. Review the records before registering.')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not parse the Word document.'
      setError(message)
      setFileName('')
    } finally {
      setBusy(false)
    }
  }

  const onFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) void runPreview(file)
  }

  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    setDragging(false)
    if (busy) return
    const file = event.dataTransfer.files?.[0]
    if (file) void runPreview(file)
  }

  const onDownloadTemplate = async () => {
    setError(null)
    try {
      await api.downloadImportTemplate()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not download the template.')
    }
  }

  const setRowEdit = (rowNumber: number, patch: Partial<RowEdit>) => {
    setEdits((current) => {
      const base: RowEdit = current[rowNumber] ?? blankRowEdit()
      return {
        ...current,
        [rowNumber]: { ...base, ...patch },
      }
    })
  }

  const setRowUniform = (rowNumber: number, slot: number, field: 'label' | 'status', value: string) => {
    setEdits((current) => {
      const base = current[rowNumber]
      if (!base) return current
      return {
        ...current,
        [rowNumber]: {
          ...base,
          uniforms: base.uniforms.map((item) => {
            if (item.slot !== slot) return item
            return field === 'label'
              ? { ...item, label: value }
              : { ...item, status: value as UniformCollectionStatus }
          }),
        },
      }
    })
  }

  const handleConfirm = async () => {
    if (!preview) return
    const payload: PupilImportConfirmRow[] = []
    for (const row of preview.rows) {
      const edit = edits[row.rowNumber]
      if (!edit?.included) continue
      const confirmRow = toConfirmRow(row, edit)
      if (confirmRow) payload.push(confirmRow)
    }
    if (payload.length === 0) {
      setError('Select at least one pupil to register.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      const confirmation = await api.confirmPupilImport({ pupils: payload })
      setResult(confirmation)
      setStep('result')
      if (confirmation.created > 0) {
        push('success', `${confirmation.created} pupil${confirmation.created === 1 ? '' : 's'} registered.`)
        await onImported()
      } else {
        push('error', 'No pupils were registered. Review the results below.')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  const handleDone = async () => {
    reset()
    await onImported()
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={
        step === 'upload'
          ? 'Import pupils from Word'
          : step === 'preview'
            ? 'Review import'
            : 'Import results'
      }
      description={
        step === 'upload'
          ? 'Upload a .docx copy of the PRPS admission form (or a Word table of pupils), review the validation report, then register them through the standard admission flow.'
          : step === 'preview'
            ? 'Fix class, gender and admission details where needed and choose which rows to register. Preview never writes to the database.'
            : 'Summary of the registration attempt. Each row used the existing pupil registration service.'
      }
      size="xl"
    >
      {step === 'upload' && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-dashed border-royal-300 bg-cream-50 p-6 text-center">
            <FileText className="mx-auto h-10 w-10 text-royal-500" aria-hidden="true" />
            <p className="mt-3 text-sm font-semibold text-ink-900">
              Drop a filled admission form here, or choose a file
            </p>
            <p className="mt-1 text-xs text-ink-500">
              Use a completed copy of the school&apos;s admission form, or a Word table with one pupil
              per row and the provided column headings.
            </p>
            <p className="mt-1 text-xs text-ink-500">Only .docx files up to 5&nbsp;MB are accepted.</p>
            <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
              <Button
                type="button"
                variant="soft"
                size="sm"
                onClick={() => void onDownloadTemplate()}
              >
                <FileDown className="h-4 w-4" aria-hidden="true" />
                Download template
              </Button>
              <Button type="button" size="sm" onClick={() => inputRef.current?.click()} disabled={busy}>
                {busy ? <Spinner className="h-4 w-4" /> : <Upload className="h-4 w-4" aria-hidden="true" />}
                Choose .docx file
              </Button>
            </div>
            <input
              ref={inputRef}
              type="file"
              accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              className="sr-only"
              aria-label="Choose Word document"
              onChange={onFileChange}
              disabled={busy}
            />
            <div
              role="presentation"
              className={`mt-4 rounded-xl border-2 border-dashed px-4 py-3 text-xs transition-colors ${
                dragging ? 'border-magenta-500 bg-magenta-50' : 'border-cream-300 bg-white'
              }`}
              onDragOver={(event) => {
                event.preventDefault()
                setDragging(true)
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
            >
              {busy
                ? `Parsing ${fileName || 'document'}…`
                : fileName
                  ? `Selected: ${fileName}`
                  : 'Or drag and drop your .docx file here'}
            </div>
          </div>

          <div className="rounded-xl bg-cream-50 p-4 text-xs leading-relaxed text-ink-600">
            <p className="font-bold uppercase tracking-wider text-ink-500">Accepted documents</p>
            <p className="mt-1">
              <strong>Admission form:</strong> a filled copy of the PRPS admission form with the
              labelled fields (NAME OF CHILD, DATE OF BIRTH, CLASS SEEKING, FATHER&apos;S NAME,
              OFFICE USE, UNIFORMS SUPPLIED, …). One pupil per document.
            </p>
            <p className="mt-1">
              <strong>Table:</strong> First Name · Last Name · Date of Birth · Gender · Class.
              Optional: Middle Name, Nationality, Religion, Guardian Name, Guardian Phone, Guardian
              Occupation, Guardian Relationship, Address, Reason for Choosing School, Admission
              Number, Sheet Number, Admission Fee, Uniform 1 to Uniform 5.
            </p>
            <p className="mt-2">
              Classes must already exist (for example <strong>Basic 3</strong> or{' '}
              <strong>Basic 3A</strong>). Unknown class names are reported as errors and are never
              auto-created.
            </p>
          </div>

          {error ? (
            <p role="alert" className="text-sm font-medium text-red-600">
              {error}
            </p>
          ) : null}
        </div>
      )}

      {step === 'preview' && preview && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
            <div className="rounded-xl bg-cream-50 p-3 text-center">
              <p className="text-lg font-extrabold text-ink-900">{preview.totalRows}</p>
              <p className="text-xs text-ink-500">Rows</p>
            </div>
            <div className="rounded-xl bg-emerald-50 p-3 text-center">
              <p className="text-lg font-extrabold text-emerald-700">{preview.validCount}</p>
              <p className="text-xs text-ink-500">Valid</p>
            </div>
            <div className="rounded-xl bg-amber-50 p-3 text-center">
              <p className="text-lg font-extrabold text-amber-700">{preview.warningCount}</p>
              <p className="text-xs text-ink-500">Warnings</p>
            </div>
            <div className="rounded-xl bg-gold-400/20 p-3 text-center">
              <p className="text-lg font-extrabold text-gold-700">{preview.duplicateCount}</p>
              <p className="text-xs text-ink-500">Duplicates</p>
            </div>
            <div className="rounded-xl bg-red-50 p-3 text-center">
              <p className="text-lg font-extrabold text-red-700">{preview.errorCount}</p>
              <p className="text-xs text-ink-500">Errors</p>
            </div>
          </div>

          <p className="text-xs text-ink-500">
            Source:{' '}
            {preview.sourceFormat === 'FORM'
              ? 'PRPS admission form document (one pupil per form)'
              : 'Word table document'}
          </p>

          {preview.sourceFormat === 'FORM' ? (
            <div className="max-h-96 space-y-3 overflow-auto rounded-xl border border-cream-200 p-3">
              {preview.rows.map((row) => {
                const edit = edits[row.rowNumber] ?? blankRowEdit()
                const rowCorrected = isRowCorrected(row, edit)
                const canInclude =
                  (row.status !== 'ERROR' || rowCorrected) &&
                  Boolean(row.data.dateOfBirth) &&
                  Boolean(row.data.gender || edit.gender) &&
                  Boolean(edit.classId)
                const statusKey: PupilImportRowStatus = rowCorrected ? 'VALID' : row.status
                const guardians: Array<{
                  fullName: string
                  relationship: string | null
                  phone: string | null
                  address?: string | null
                  occupation: string | null
                }> =
                  row.data.guardians && row.data.guardians.length > 0
                    ? row.data.guardians
                    : row.data.guardian
                      ? [row.data.guardian]
                      : []
                return (
                  <article key={row.rowNumber} className="rounded-xl border border-cream-200 bg-white p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <label className="flex items-center gap-2 text-xs font-bold text-ink-700">
                        <input
                          type="checkbox"
                          aria-label={`Include row ${row.rowNumber}`}
                          checked={edit.included && canInclude}
                          disabled={!canInclude}
                          onChange={(event) =>
                            setRowEdit(row.rowNumber, { included: event.target.checked })
                          }
                          className="h-4 w-4 rounded border-cream-300 text-magenta-600 focus:ring-magenta-500"
                        />
                        Form {row.rowNumber}: {row.fullName}
                      </label>
                      <Badge tone={STATUS_TONE[statusKey]}>{STATUS_LABEL[statusKey]}</Badge>
                    </div>

                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                      <section className="rounded-lg bg-cream-50 p-3">
                        <p className="text-[11px] font-bold uppercase tracking-wider text-ink-500">
                          Child information
                        </p>
                        <dl className="mt-2 space-y-1 text-xs text-ink-700">
                          <div className="flex justify-between gap-2">
                            <dt className="text-ink-500">Name of child</dt>
                            <dd className="font-semibold">{row.fullName}</dd>
                          </div>
                          <div className="flex justify-between gap-2">
                            <dt className="text-ink-500">Date of birth</dt>
                            <dd>{row.data.dateOfBirth ?? '—'}</dd>
                          </div>
                          <div className="flex justify-between gap-2">
                            <dt className="text-ink-500">House number</dt>
                            <dd>{row.data.address ?? '—'}</dd>
                          </div>
                          <div className="flex justify-between gap-2">
                            <dt className="text-ink-500">School attended</dt>
                            <dd>{row.data.previousSchool ?? '—'}</dd>
                          </div>
                          <div className="flex justify-between gap-2">
                            <dt className="text-ink-500">Nationality</dt>
                            <dd>{row.data.nationality ?? '—'}</dd>
                          </div>
                          <div className="flex justify-between gap-2">
                            <dt className="text-ink-500">Religion</dt>
                            <dd>{row.data.religion ?? '—'}</dd>
                          </div>
                          <div className="flex justify-between gap-2">
                            <dt className="text-ink-500">Reason for joining school</dt>
                            <dd className="text-right">{row.data.admissionReason ?? '—'}</dd>
                          </div>
                        </dl>
                        <div className="mt-2 grid grid-cols-2 gap-2">
                          <label className="text-[11px] font-semibold text-ink-600">
                            Gender
                            <select
                              aria-label={`Gender for row ${row.rowNumber}`}
                              value={edit.gender}
                              onChange={(event) =>
                                setRowEdit(row.rowNumber, {
                                  gender: event.target.value as PupilGender | '',
                                })
                              }
                              className="mt-1 w-full rounded-lg border border-cream-300 bg-white px-2 py-1 text-xs text-ink-900 outline-none focus:border-magenta-500"
                            >
                              <option value="">Select…</option>
                              <option value="MALE">Male</option>
                              <option value="FEMALE">Female</option>
                            </select>
                          </label>
                          <label className="text-[11px] font-semibold text-ink-600">
                            Class
                            <select
                              aria-label={`Class for row ${row.rowNumber}`}
                              value={edit.classId}
                              onChange={(event) =>
                                setRowEdit(row.rowNumber, { classId: event.target.value })
                              }
                              className="mt-1 w-full rounded-lg border border-cream-300 bg-white px-2 py-1 text-xs text-ink-900 outline-none focus:border-magenta-500"
                            >
                              <option value="">Select class…</option>
                              {activeClasses.map((klass) => (
                                <option key={klass.id} value={klass.id}>
                                  {klass.name}
                                </option>
                              ))}
                              {edit.classId &&
                              !activeClasses.some((klass) => klass.id === edit.classId) ? (
                                <option value={edit.classId}>{row.data.classLabel}</option>
                              ) : null}
                            </select>
                          </label>
                        </div>
                      </section>

                      <section className="rounded-lg bg-cream-50 p-3">
                        <p className="text-[11px] font-bold uppercase tracking-wider text-ink-500">
                          Parents &amp; guardians
                        </p>
                        {guardians.length > 0 ? (
                          <ul className="mt-2 space-y-1.5 text-xs text-ink-700">
                            {guardians.map((guardian, guardianIndex) => (
                              <li key={`${row.rowNumber}-guardian-${guardianIndex}`}>
                                <span className="font-semibold">{guardian.fullName}</span>
                                <span className="text-ink-500">
                                  {' '}
                                  · {guardian.relationship || 'Guardian'}
                                </span>
                                {guardian.phone ? (
                                  <span className="block text-ink-500">{guardian.phone}</span>
                                ) : null}
                                {guardian.address ? (
                                  <span className="block text-ink-500">{guardian.address}</span>
                                ) : null}
                                {guardian.occupation ? (
                                  <span className="block text-ink-500">{guardian.occupation}</span>
                                ) : null}
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p className="mt-2 text-xs text-ink-400">No parent or guardian captured.</p>
                        )}
                      </section>

                      <section className="rounded-lg bg-cream-50 p-3">
                        <p className="text-[11px] font-bold uppercase tracking-wider text-ink-500">
                          Office use
                        </p>
                        <div className="mt-2 grid grid-cols-2 gap-2 text-[11px] font-semibold text-ink-600">
                          <label>
                            Admission number
                            <input
                              type="text"
                              aria-label={`Admission number for row ${row.rowNumber}`}
                              value={edit.admissionNumber}
                              onChange={(event) =>
                                setRowEdit(row.rowNumber, {
                                  admissionNumber: event.target.value,
                                })
                              }
                              placeholder="—"
                              className="mt-1 w-full rounded-lg border border-cream-300 bg-white px-2 py-1 text-xs font-normal text-ink-900 outline-none focus:border-magenta-500"
                            />
                          </label>
                          <label>
                            Sheet number
                            <input
                              type="text"
                              aria-label={`Sheet number for row ${row.rowNumber}`}
                              value={edit.sheetNumber}
                              onChange={(event) =>
                                setRowEdit(row.rowNumber, { sheetNumber: event.target.value })
                              }
                              placeholder="—"
                              className="mt-1 w-full rounded-lg border border-cream-300 bg-white px-2 py-1 text-xs font-normal text-ink-900 outline-none focus:border-magenta-500"
                            />
                          </label>
                          <label>
                            Admission fee
                            <input
                              type="text"
                              aria-label={`Admission fee for row ${row.rowNumber}`}
                              value={edit.admissionFee}
                              onChange={(event) =>
                                setRowEdit(row.rowNumber, { admissionFee: event.target.value })
                              }
                              placeholder="—"
                              className="mt-1 w-full rounded-lg border border-cream-300 bg-white px-2 py-1 text-xs font-normal text-ink-900 outline-none focus:border-magenta-500"
                            />
                          </label>
                          <div>
                            <span className="text-ink-500">Date of admission</span>
                            <p className="mt-1 font-normal text-ink-900">
                              {row.data.dateAdmitted ?? '—'}
                            </p>
                          </div>
                        </div>
                        <p className="mt-2 text-[11px] text-ink-500">
                          Declaration:{' '}
                          <span className="font-semibold text-ink-700">
                            {row.data.declarationAcknowledged ? 'Acknowledged' : 'Not acknowledged'}
                          </span>
                        </p>
                      </section>

                      <section className="rounded-lg bg-cream-50 p-3">
                        <p className="text-[11px] font-bold uppercase tracking-wider text-ink-500">
                          Uniforms supplied
                        </p>
                        <div className="mt-2 space-y-1.5">
                          {edit.uniforms.map((uniform) => (
                            <div
                              key={uniform.slot}
                              className="flex items-center justify-between gap-2 text-xs"
                            >
                              <span className="text-ink-700">
                                {uniform.label || `Uniform ${uniform.slot}`}
                              </span>
                              <select
                                aria-label={`Uniform ${uniform.slot} status for row ${row.rowNumber}`}
                                value={uniform.status}
                                onChange={(event) =>
                                  setRowUniform(
                                    row.rowNumber,
                                    uniform.slot,
                                    'status',
                                    event.target.value,
                                  )
                                }
                                className="rounded-lg border border-cream-300 bg-white px-1.5 py-1 text-xs text-ink-900 outline-none focus:border-magenta-500"
                              >
                                <option value="NOT_COLLECTED">Not collected</option>
                                <option value="COLLECTED">Collected</option>
                              </select>
                            </div>
                          ))}
                        </div>
                      </section>
                    </div>

                    <div className="mt-3 border-t border-cream-200 pt-2 text-xs text-ink-500">
                      {row.messages.length > 0
                        ? rowCorrected
                          ? correctedNote(row, edit, activeClasses)
                          : row.messages.join(' · ')
                        : '—'}
                      {row.warnings && row.warnings.length > 0 ? (
                        <span className="mt-1 block text-amber-600">
                          {row.warnings.join(' · ')}
                        </span>
                      ) : null}
                      {row.duplicateOf ? (
                        <span className="block text-ink-400">
                          Existing: {row.duplicateOf.pupilId}
                        </span>
                      ) : null}
                    </div>
                  </article>
                )
              })}
            </div>
          ) : (
          <div className="max-h-72 overflow-auto rounded-xl border border-cream-200">
            <table className="w-full text-left text-sm">
              <thead className="sticky top-0 z-10 border-b border-cream-200 bg-cream-50 text-xs font-bold uppercase tracking-wider text-ink-500">
                <tr>
                  <th scope="col" className="px-3 py-2.5">In</th>
                  <th scope="col" className="px-3 py-2.5">#</th>
                  <th scope="col" className="px-3 py-2.5">Pupil</th>
                  <th scope="col" className="px-3 py-2.5">DOB</th>
                  <th scope="col" className="px-3 py-2.5">Gender</th>
                  <th scope="col" className="px-3 py-2.5">Class</th>
                  <th scope="col" className="px-3 py-2.5">Admission No.</th>
                  <th scope="col" className="px-3 py-2.5">Sheet</th>
                  <th scope="col" className="px-3 py-2.5">Fee</th>
                  <th scope="col" className="px-3 py-2.5">Uniforms</th>
                  <th scope="col" className="px-3 py-2.5">Guardian</th>
                  <th scope="col" className="px-3 py-2.5">Status</th>
                  <th scope="col" className="px-3 py-2.5">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-cream-200">
                {preview.rows.map((row) => {
                  const edit = edits[row.rowNumber] ?? blankRowEdit()
                  const rowCorrected = isRowCorrected(row, edit)
                  const canInclude =
                    (row.status !== 'ERROR' || rowCorrected) &&
                    Boolean(row.data.dateOfBirth) &&
                    Boolean(row.data.gender || edit.gender) &&
                    Boolean(edit.classId)
                  const statusKey: PupilImportRowStatus = rowCorrected ? 'VALID' : row.status
                  return (
                    <tr key={row.rowNumber} className="align-top">
                      <td className="px-3 py-2.5">
                        <input
                          type="checkbox"
                          aria-label={`Include row ${row.rowNumber}`}
                          checked={edit.included && canInclude}
                          disabled={!canInclude}
                          onChange={(event) =>
                            setRowEdit(row.rowNumber, { included: event.target.checked })
                          }
                          className="h-4 w-4 rounded border-cream-300 text-magenta-600 focus:ring-magenta-500"
                        />
                      </td>
                      <td className="px-3 py-2.5 text-ink-500">{row.rowNumber}</td>
                      <td className="px-3 py-2.5 font-semibold text-ink-900">{row.fullName}</td>
                      <td className="px-3 py-2.5 text-ink-700">{row.data.dateOfBirth ?? '—'}</td>
                      <td className="px-3 py-2.5">
                        <select
                          aria-label={`Gender for row ${row.rowNumber}`}
                          value={edit.gender}
                          onChange={(event) =>
                            setRowEdit(row.rowNumber, {
                              gender: event.target.value as PupilGender | '',
                            })
                          }
                          className="w-full min-w-24 rounded-lg border border-cream-300 bg-white px-2 py-1 text-xs text-ink-900 outline-none focus:border-magenta-500"
                        >
                          <option value="">Select…</option>
                          <option value="MALE">Male</option>
                          <option value="FEMALE">Female</option>
                        </select>
                      </td>
                      <td className="px-3 py-2.5">
                        <select
                          aria-label={`Class for row ${row.rowNumber}`}
                          value={edit.classId}
                          onChange={(event) =>
                            setRowEdit(row.rowNumber, { classId: event.target.value })
                          }
                          className="w-full min-w-28 rounded-lg border border-cream-300 bg-white px-2 py-1 text-xs text-ink-900 outline-none focus:border-magenta-500"
                        >
                          <option value="">Select class…</option>
                          {activeClasses.map((klass) => (
                            <option key={klass.id} value={klass.id}>
                              {klass.name}
                            </option>
                          ))}
                          {edit.classId && !activeClasses.some((klass) => klass.id === edit.classId) ? (
                            <option value={edit.classId}>{row.data.classLabel}</option>
                          ) : null}
                        </select>
                      </td>
                      <td className="px-3 py-2.5">
                        <input
                          type="text"
                          aria-label={`Admission number for row ${row.rowNumber}`}
                          value={edit.admissionNumber}
                          onChange={(event) =>
                            setRowEdit(row.rowNumber, { admissionNumber: event.target.value })
                          }
                          placeholder="—"
                          className="w-32 rounded-lg border border-cream-300 bg-white px-2 py-1 text-xs text-ink-900 outline-none focus:border-magenta-500"
                        />
                      </td>
                      <td className="px-3 py-2.5">
                        <input
                          type="text"
                          aria-label={`Sheet number for row ${row.rowNumber}`}
                          value={edit.sheetNumber}
                          onChange={(event) =>
                            setRowEdit(row.rowNumber, { sheetNumber: event.target.value })
                          }
                          placeholder="—"
                          className="w-20 rounded-lg border border-cream-300 bg-white px-2 py-1 text-xs text-ink-900 outline-none focus:border-magenta-500"
                        />
                      </td>
                      <td className="px-3 py-2.5">
                        <input
                          type="text"
                          aria-label={`Admission fee for row ${row.rowNumber}`}
                          value={edit.admissionFee}
                          onChange={(event) =>
                            setRowEdit(row.rowNumber, { admissionFee: event.target.value })
                          }
                          placeholder="—"
                          className="w-24 rounded-lg border border-cream-300 bg-white px-2 py-1 text-xs text-ink-900 outline-none focus:border-magenta-500"
                        />
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="space-y-1.5">
                          {edit.uniforms.map((uniform, uniformIndex) => (
                            <div key={uniform.slot} className="flex items-center gap-1.5">
                              <span className="w-3 text-[10px] font-bold text-ink-400">
                                {uniformIndex + 1}
                              </span>
                              <input
                                type="text"
                                aria-label={`Uniform ${uniform.slot} description for row ${row.rowNumber}`}
                                value={uniform.label}
                                onChange={(event) =>
                                  setRowUniform(row.rowNumber, uniform.slot, 'label', event.target.value)
                                }
                                placeholder={`Uniform ${uniform.slot}`}
                                className="w-28 rounded-lg border border-cream-300 bg-white px-2 py-1 text-xs text-ink-900 outline-none focus:border-magenta-500"
                              />
                              <select
                                aria-label={`Uniform ${uniform.slot} status for row ${row.rowNumber}`}
                                value={uniform.status}
                                onChange={(event) =>
                                  setRowUniform(row.rowNumber, uniform.slot, 'status', event.target.value)
                                }
                                className="rounded-lg border border-cream-300 bg-white px-1.5 py-1 text-xs text-ink-900 outline-none focus:border-magenta-500"
                              >
                                <option value="NOT_COLLECTED">Not collected</option>
                                <option value="COLLECTED">Collected</option>
                              </select>
                            </div>
                          ))}
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-ink-700">
                        {row.data.guardian ? row.data.guardian.fullName : '—'}
                      </td>
                      <td className="px-3 py-2.5">
                        <Badge tone={STATUS_TONE[statusKey]}>{STATUS_LABEL[statusKey]}</Badge>
                      </td>
                      <td className="max-w-56 px-3 py-2.5 text-xs text-ink-500">
                        {row.messages.length > 0
                          ? rowCorrected
                            ? correctedNote(row, edit, activeClasses)
                            : row.messages.join(' · ')
                          : '—'}
                        {row.warnings && row.warnings.length > 0 ? (
                          <span className="mt-1 block text-amber-600">
                            {row.warnings.join(' · ')}
                          </span>
                        ) : null}
                        {row.duplicateOf ? (
                          <span className="block text-ink-400">
                            Existing: {row.duplicateOf.pupilId}
                          </span>
                        ) : null}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-ink-500">
              {selectedCount} of {preview.totalRows} rows selected ·
              Preview does not create any records.
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="cream"
                size="sm"
                onClick={() => {
                  reset()
                }}
                disabled={busy}
              >
                Choose another file
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={() => void handleConfirm()}
                disabled={busy || selectedCount === 0}
              >
                {busy ? <Spinner className="h-4 w-4" /> : null}
                Confirm &amp; Register Pupils ({selectedCount})
              </Button>
            </div>
          </div>

          {error ? (
            <p role="alert" className="text-sm font-medium text-red-600">
              {error}
            </p>
          ) : null}
        </div>
      )}

      {step === 'result' && result && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <div className="rounded-xl bg-cream-50 p-3 text-center">
              <p className="text-lg font-extrabold text-ink-900">{result.total}</p>
              <p className="text-xs text-ink-500">Attempted</p>
            </div>
            <div className="rounded-xl bg-emerald-50 p-3 text-center">
              <p className="text-lg font-extrabold text-emerald-700">{result.created}</p>
              <p className="text-xs text-ink-500">Registered</p>
            </div>
            <div className="rounded-xl bg-gold-400/20 p-3 text-center">
              <p className="text-lg font-extrabold text-gold-700">{result.skipped}</p>
              <p className="text-xs text-ink-500">Skipped</p>
            </div>
            <div className="rounded-xl bg-red-50 p-3 text-center">
              <p className="text-lg font-extrabold text-red-700">{result.failed}</p>
              <p className="text-xs text-ink-500">Failed</p>
            </div>
          </div>

          <div className="max-h-64 overflow-auto rounded-xl border border-cream-200">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-cream-200 bg-cream-50 text-xs font-bold uppercase tracking-wider text-ink-500">
                <tr>
                  <th scope="col" className="px-3 py-2.5">#</th>
                  <th scope="col" className="px-3 py-2.5">Pupil</th>
                  <th scope="col" className="px-3 py-2.5">Result</th>
                  <th scope="col" className="px-3 py-2.5">Detail</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-cream-200">
                {result.results.map((entry) => (
                  <tr key={`${entry.rowNumber}-${entry.status}`}>
                    <td className="px-3 py-2.5 text-ink-500">{entry.rowNumber}</td>
                    <td className="px-3 py-2.5 font-semibold text-ink-900">{entry.fullName}</td>
                    <td className="px-3 py-2.5">
                      <Badge
                        tone={
                          entry.status === 'CREATED'
                            ? 'green'
                            : entry.status === 'SKIPPED'
                              ? 'gold'
                              : 'red'
                        }
                      >
                        {entry.status}
                      </Badge>
                    </td>
                    <td className="px-3 py-2.5 text-xs text-ink-500">
                      {entry.pupilId ?? entry.reason ?? '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" size="sm" onClick={() => void handleDone()}>
              Done
            </Button>
          </div>
        </div>
      )}
    </Modal>
  )
}
