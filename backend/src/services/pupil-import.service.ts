import { parse } from 'node-html-parser'
import mammoth from 'mammoth'
import JSZip from 'jszip'
import { HttpStatus } from '../config/enums'
import { prisma } from '../lib/prisma'
import type { AuthenticatedUser } from '../types/auth'
import { AppError } from '../utils/app-error'
import { recordAudit } from './audit.service'
import {
  ADMISSION_UNIFORM_ITEMS,
  createPupil,
  type PupilCreateInput,
  type PupilGender,
} from './pupil.service'

/**
 * Word (.docx) pupil admission import.
 *
 * Stateless flow: upload -> parse -> preview (no DB writes) -> confirm -> register.
 * Confirmation reuses the existing `createPupil` service for every row, so
 * validation, student-ID generation, guardian linking, fee assignment, status
 * handling and per-pupil audit logging stay identical to manual registration.
 *
 * Two document structures are recognised:
 *   Format A - the original table import (one pupil per row, column headings).
 *   Format B - the actual PRPS "ADMISSION FORM" document with labelled fields
 *              (NAME OF CHILD:, DATE OF BIRTH:, OFFICE USE:, UNIFORMS SUPPLIED:...).
 * Both paths normalise into the same draft shape and therefore the same
 * `createPupil` payload.
 */

export type ImportRowStatus = 'VALID' | 'WARNING' | 'DUPLICATE' | 'ERROR'

/** Which document structure the upload matched. */
export type ImportSourceFormat = 'TABLE' | 'FORM'

/** One guardian extracted for the preview / confirmation payload. */
export interface PImportGuardian {
  fullName: string
  phone: string | null
  address: string | null
  occupation: string | null
  relationship: string | null
  isPrimary: boolean
  isEmergency: boolean
}

export interface PupilImportPreviewRow {
  rowNumber: number
  status: ImportRowStatus
  messages: string[]
  /**
   * Non-blocking notices (e.g. an unreadable uniform tick) that do not stop
   * the row from being registered, unlike `messages`.
   */
  warnings: string[]
  /**
   * True when the row's only problems are class-related
   * ("Class not found" / "Class is required.") so the Headteacher can fix it
   * by picking an existing class in the preview instead of editing the file.
   */
  correctableClass: boolean
  /**
   * True when every message on the row can be fixed directly in the preview
   * (class selection, gender, or the admission number / sheet number /
   * admission fee / uniform label problems). Frontends fall back to
   * `correctableClass` when this field is absent.
   */
  correctable: boolean
  fullName: string
  data: {
    firstName: string
    middleName: string | null
    lastName: string
    dateOfBirth: string | null
    gender: PupilGender | null
    classId: string | null
    classLabel: string
    /** "DATE OF ADMISSION" from the admission form, when present. */
    dateAdmitted: string | null
    address: string | null
    /** "SCHOOL ATTENDED" from the admission form, when present. */
    previousSchool: string | null
    /** "STAY WITH THE CHILD" living arrangement, when present. */
    stayWithChild: string | null
    nationality: string | null
    religion: string | null
    admissionReason: string | null
    /** Guardian's Declaration section present/filled on the form. */
    declarationAcknowledged: boolean
    admissionNumber: string | null
    sheetNumber: string | null
    /** Normalised amount, the raw cell when it could not be parsed, else null. */
    admissionFee: string | null
    /** Always the five admission slots, padded with "Not collected". */
    uniforms: Array<{ slot: number; label: string | null; status: 'NOT_COLLECTED' | 'COLLECTED' }>
    /** Every guardian extracted from the document (father, mother, ...). */
    guardians: PImportGuardian[]
    /** First guardian, kept for backwards compatibility (`guardians[0]`). */
    guardian: {
      fullName: string
      phone: string | null
      address: string | null
      occupation: string | null
      relationship: string | null
    } | null
  }
  duplicateOf: { pupilId: string; fullName: string } | null
}

export interface PupilImportPreview {
  /** 'TABLE' = one-pupil-per-row import, 'FORM' = PRPS admission-form document. */
  sourceFormat: ImportSourceFormat
  totalRows: number
  validCount: number
  warningCount: number
  duplicateCount: number
  errorCount: number
  rows: PupilImportPreviewRow[]
}

export type ImportResultStatus = 'CREATED' | 'SKIPPED' | 'FAILED'

export interface PupilImportConfirmResult {
  total: number
  created: number
  skipped: number
  failed: number
  results: Array<{
    rowNumber: number
    fullName: string
    status: ImportResultStatus
    pupilId?: string
    reason?: string
  }>
}

interface RawTable {
  headers: string[]
  rows: string[][]
}

type ColumnKey =
  | 'firstName'
  | 'middleName'
  | 'lastName'
  | 'dateOfBirth'
  | 'dateAdmitted'
  | 'gender'
  | 'nationality'
  | 'religion'
  | 'class'
  | 'previousSchool'
  | 'stayWithChild'
  | 'admissionNumber'
  | 'sheetNumber'
  | 'admissionFee'
  | 'uniform1'
  | 'uniform2'
  | 'uniform3'
  | 'uniform4'
  | 'uniform5'
  | 'guardianName'
  | 'guardianPhone'
  | 'guardianOccupation'
  | 'guardianRelationship'
  | 'address'
  | 'admissionReason'

/** The five "Uniforms to be Collected" columns, slot 1..5. */
const UNIFORM_COLUMNS = ['uniform1', 'uniform2', 'uniform3', 'uniform4', 'uniform5'] as const

/** Raw text of the five admission uniform slots (no collection status yet). */
export type ParsedUniform = {
  slot: number
  label: string | null
  status: 'NOT_COLLECTED' | 'COLLECTED'
}

/**
 * Deterministic column-header aliases. Keys are normalized headers
 * (lowercase, non-alphanumeric stripped): "First Name" -> "firstname".
 * Unknown columns are ignored -- they are never invented into DB fields.
 */
const COLUMN_ALIASES: Record<string, ColumnKey> = {
  firstname: 'firstName',
  first: 'firstName',
  givenname: 'firstName',
  childname: 'firstName',
  pupilname: 'firstName',
  middlename: 'middleName',
  middle: 'middleName',
  lastname: 'lastName',
  surname: 'lastName',
  familyname: 'lastName',
  dateofbirth: 'dateOfBirth',
  dob: 'dateOfBirth',
  birthdate: 'dateOfBirth',
  birthday: 'dateOfBirth',
  dateadmitted: 'dateAdmitted',
  admissiondate: 'dateAdmitted',
  dateofadmission: 'dateAdmitted',
  gender: 'gender',
  sex: 'gender',
  nationality: 'nationality',
  religion: 'religion',
  class: 'class',
  classname: 'class',
  grade: 'class',
  form: 'class',
  classseeking: 'class',
  schoolattended: 'previousSchool',
  previousschool: 'previousSchool',
  schoolpreviouslyattended: 'previousSchool',
  staywithchild: 'stayWithChild',
  staywiththechild: 'stayWithChild',
  livingarrangement: 'stayWithChild',
  guardianname: 'guardianName',
  guardian: 'guardianName',
  parentname: 'guardianName',
  parent: 'guardianName',
  guardianfullname: 'guardianName',
  parentfullname: 'guardianName',
  guardianphone: 'guardianPhone',
  phone: 'guardianPhone',
  phonenumber: 'guardianPhone',
  contactphone: 'guardianPhone',
  telephone: 'guardianPhone',
  guardianoccupation: 'guardianOccupation',
  occupation: 'guardianOccupation',
  parentoccupation: 'guardianOccupation',
  guardianrelationship: 'guardianRelationship',
  relationship: 'guardianRelationship',
  parentrelationship: 'guardianRelationship',
  address: 'address',
  homeaddress: 'address',
  residence: 'address',
  reasonforchoosingschool: 'admissionReason',
  reason: 'admissionReason',
  admissionreason: 'admissionReason',
  whythisschool: 'admissionReason',
  admissionnumber: 'admissionNumber',
  admissionno: 'admissionNumber',
  admissionnum: 'admissionNumber',
  admno: 'admissionNumber',
  sheetnumber: 'sheetNumber',
  sheetno: 'sheetNumber',
  sheetnum: 'sheetNumber',
  sheet: 'sheetNumber',
  admissionfee: 'admissionFee',
  admissionfees: 'admissionFee',
  admissionamount: 'admissionFee',
  uniform1: 'uniform1',
  uniformitem1: 'uniform1',
  uniformno1: 'uniform1',
  uniformi: 'uniform1',
  uniform2: 'uniform2',
  uniformitem2: 'uniform2',
  uniformno2: 'uniform2',
  uniformii: 'uniform2',
  uniform3: 'uniform3',
  uniformitem3: 'uniform3',
  uniformno3: 'uniform3',
  uniformiii: 'uniform3',
  uniform4: 'uniform4',
  uniformitem4: 'uniform4',
  uniformno4: 'uniform4',
  uniformiv: 'uniform4',
  uniform5: 'uniform5',
  uniformitem5: 'uniform5',
  uniformno5: 'uniform5',
  uniformv: 'uniform5',
}

const REQUIRED_COLUMNS: ColumnKey[] = ['firstName', 'lastName', 'dateOfBirth', 'gender', 'class']

/** Row messages that only need a class re-selection in the preview to resolve. */
const CLASS_ONLY_MESSAGES = new Set(['Class not found', 'Class is required.'])

/**
 * Row messages about the new admission columns that the Headteacher can fix
 * directly in the preview (same "correctable" workflow as the class messages).
 */
const ADMISSION_ONLY_MESSAGES = new Set([
  'Admission number is too long.',
  'Sheet number is too long.',
  'Admission fee is not a valid amount.',
  'A uniform label is too long.',
])

/**
 * Row messages that only need a re-selection / re-entry in the preview to
 * resolve. The physical admission form has no gender column, so gender is
 * correctable in the preview just like the class.
 */
const CORRECTABLE_MESSAGES = new Set([
  ...CLASS_ONLY_MESSAGES,
  ...ADMISSION_ONLY_MESSAGES,
  'Gender is required.',
  'Gender must be Male or Female.',
])

const REQUIRED_COLUMN_LABELS: Record<ColumnKey, string> = {
  firstName: 'First Name',
  middleName: 'Middle Name',
  lastName: 'Last Name (or Surname)',
  dateOfBirth: 'Date of Birth',
  dateAdmitted: 'Date of Admission',
  gender: 'Gender',
  nationality: 'Nationality',
  religion: 'Religion',
  class: 'Class',
  previousSchool: 'School Attended',
  stayWithChild: 'Stay With the Child',
  admissionNumber: 'Admission Number',
  sheetNumber: 'Sheet Number',
  admissionFee: 'Admission Fee',
  uniform1: 'Uniform 1',
  uniform2: 'Uniform 2',
  uniform3: 'Uniform 3',
  uniform4: 'Uniform 4',
  uniform5: 'Uniform 5',
  guardianName: 'Guardian Name',
  guardianPhone: 'Guardian Phone',
  guardianOccupation: 'Guardian Occupation',
  guardianRelationship: 'Guardian Relationship',
  address: 'Address',
  admissionReason: 'Reason for Choosing School',
}

const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
const MAX_IMPORT_FILE_SIZE = 5 * 1024 * 1024
const MAX_IMPORT_ROWS = 100
const MAX_ADMISSION_NUMBER_LENGTH = 40
const MAX_SHEET_NUMBER_LENGTH = 40
const MAX_UNIFORM_LABEL_LENGTH = 80

// ---------------------------------------------------------------------------
// File validation (treat every upload as untrusted)
// ---------------------------------------------------------------------------

export function assertUsableDocxUpload(file: {
  originalname: string
  mimetype: string
  size: number
  buffer: Buffer
}): void {
  const name = (file.originalname || '').toLowerCase()
  if (name.endsWith('.doc')) {
    throw new AppError(
      'Old binary .doc files are not supported. Please save the document as .docx.',
      HttpStatus.BadRequest,
    )
  }
  if (!name.endsWith('.docx')) {
    throw new AppError('Please upload a Microsoft Word (.docx) document.', HttpStatus.BadRequest)
  }
  if (file.size > MAX_IMPORT_FILE_SIZE) {
    throw new AppError('The document must be 5 MB or smaller.', HttpStatus.BadRequest)
  }
  const mimeOk =
    file.mimetype === DOCX_MIME ||
    file.mimetype === 'application/octet-stream' ||
    file.mimetype === '' ||
    file.mimetype === 'application/zip'
  if (!mimeOk) {
    throw new AppError('The uploaded file does not look like a Word document.', HttpStatus.BadRequest)
  }
  // .docx is an OPC package (ZIP). Verify the magic bytes before parsing.
  if (file.buffer.length < 4 || file.buffer[0] !== 0x50 || file.buffer[1] !== 0x4b) {
    throw new AppError('The uploaded file is not a valid Word (.docx) document.', HttpStatus.BadRequest)
  }
}

// ---------------------------------------------------------------------------
// DOCX -> table extraction
// ---------------------------------------------------------------------------

function normalizeHeader(header: string): string {
  return header.toLowerCase().replace(/[^a-z0-9]/g, '')
}

function cellText(cell: { text?: string; textContent?: string } | null | undefined): string {
  const raw = cell?.text ?? cell?.textContent ?? ''
  return raw.replace(/\s+/g, ' ').trim()
}

/** Extracts the first table (header row + data rows) from a DOCX buffer. */
export async function extractTableFromDocx(buffer: Buffer): Promise<RawTable> {
  let html: string
  try {
    const result = await mammoth.convertToHtml({ buffer })
    html = result.value
  } catch {
    throw new AppError(
      'The document could not be read. Please ensure it is a valid .docx file.',
      HttpStatus.BadRequest,
    )
  }

  const root = parse(html)
  const table = root.querySelector('table')
  if (!table) {
    throw new AppError(
      'No table found in the document. For best results, use a Word table with one pupil per row and the provided column headings.',
      HttpStatus.BadRequest,
    )
  }

  const trElements = table.querySelectorAll('tr')
  if (trElements.length < 2) {
    throw new AppError(
      'The table has no data rows. Add one pupil per row beneath the header row.',
      HttpStatus.BadRequest,
    )
  }

  const rows = trElements.map((tr) => tr.querySelectorAll('td, th').map((cell) => cellText(cell)))
  const headers = rows[0]
  const dataRows = rows.slice(1).filter((row) => row.some((cell) => cell !== ''))

  if (dataRows.length === 0) {
    throw new AppError('The table contains a header row but no pupil records.', HttpStatus.BadRequest)
  }
  if (dataRows.length > MAX_IMPORT_ROWS) {
    throw new AppError(`A maximum of ${MAX_IMPORT_ROWS} pupils can be imported per document.`, HttpStatus.BadRequest)
  }

  return { headers, rows: dataRows }
}

/** Maps header cells to column keys. */
export function mapColumns(headers: string[]): {
  columnIndex: Partial<Record<ColumnKey, number>>
  missingRequired: ColumnKey[]
  recognizedCount: number
} {
  const columnIndex: Partial<Record<ColumnKey, number>> = {}
  headers.forEach((header, index) => {
    const key = COLUMN_ALIASES[normalizeHeader(header)]
    if (key && columnIndex[key] === undefined) {
      columnIndex[key] = index
    }
  })
  const missingRequired = REQUIRED_COLUMNS.filter((key) => columnIndex[key] === undefined)
  return { columnIndex, missingRequired, recognizedCount: Object.keys(columnIndex).length }
}

// ---------------------------------------------------------------------------
// Value parsing helpers
// ---------------------------------------------------------------------------

function clean(value: string | undefined | null): string {
  return (value ?? '').replace(/\s+/g, ' ').trim()
}

function optional(value: string): string | undefined {
  const trimmed = clean(value)
  return trimmed === '' ? undefined : trimmed
}

export type ParsedAdmissionFee =
  | { status: 'empty' }
  | { status: 'ok'; value: string }
  | { status: 'invalid' }

/** Cell values that mean "no admission fee entered" rather than a bad number. */
const ADMISSION_FEE_PLACEHOLDERS = new Set(['-', '—', 'free', 'nil', 'none', 'n/a', 'na'])

/**
 * Parses the admission fee cell into plain money ("GH₵ 1,500" -> "1500").
 * Currency words/symbols and thousands separators are stripped; anything
 * that still is not a plain decimal amount is reported as invalid so the
 * Headteacher can correct it in the preview.
 */
export function parseAdmissionFee(value: string): ParsedAdmissionFee {
  const raw = clean(value)
  if (raw === '') return { status: 'empty' }
  if (ADMISSION_FEE_PLACEHOLDERS.has(raw.toLowerCase())) return { status: 'empty' }

  const normalized = raw
    .toLowerCase()
    .replace(/gh\u20b5|ghs|gh|\u20b5|\u00a2/gi, '')
    .replace(/[,\s]/g, '')

  if (normalized === '') return { status: 'empty' }
  if (/^\d+(\.\d{1,2})?$/.test(normalized)) return { status: 'ok', value: normalized }
  return { status: 'invalid' }
}

/** Values that only express the collection state of a uniform slot. */
const UNIFORM_COLLECTED_VALUES = new Set(['yes', 'y', 'true', '1', 'collected', 'collect', 'done', 'x', '✓'])
const UNIFORM_NOT_COLLECTED_VALUES = new Set([
  'no',
  'n',
  'false',
  '0',
  'not collected',
  'uncollected',
  'pending',
  'outstanding',
])

/**
 * Parses one "Uniform N" cell. A plain yes/no answer only sets the collection
 * status; any other text is kept as the item label (the school may write its
 * own uniform names) with the default "Not collected" status.
 */
export function parseUniformCell(slot: number, value: string): ParsedUniform {
  const raw = clean(value)
  if (raw === '') return { slot, label: null, status: 'NOT_COLLECTED' }

  const normalized = raw.toLowerCase().replace(/[.?]+$/, '').trim()
  if (UNIFORM_COLLECTED_VALUES.has(normalized)) return { slot, label: null, status: 'COLLECTED' }
  if (UNIFORM_NOT_COLLECTED_VALUES.has(normalized)) return { slot, label: null, status: 'NOT_COLLECTED' }
  return { slot, label: raw, status: 'NOT_COLLECTED' }
}

/** Parses gender from common Word spellings. Returns null when unrecognised. */
export function parseGender(value: string): PupilGender | null {
  const normalized = clean(value).toLowerCase()
  if (normalized === '') return null
  if (['male', 'm', 'boy', 'masculine'].includes(normalized)) return 'MALE'
  if (['female', 'f', 'girl', 'feminine'].includes(normalized)) return 'FEMALE'
  return null
}

/**
 * Parses a date into `yyyy-mm-dd`. Accepts ISO, dd/mm/yyyy, dd-mm-yyyy,
 * two-digit years (28/10/24 -> 2024, as written on the physical admission
 * form), and JS-parsable textual dates. Returns null when invalid.
 */
export function parseDateOfBirth(value: string): string | null {
  const raw = clean(value)
  if (raw === '') return null

  const isoMatch = raw.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/)
  if (isoMatch) {
    const [, y, m, d] = isoMatch
    return buildIso(Number(y), Number(m), Number(d))
  }

  const dmyMatch = raw.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/)
  if (dmyMatch) {
    const [, d, m, y] = dmyMatch
    return buildIso(Number(y), Number(m), Number(d))
  }

  // The school's Word form writes short years: "28/10/24", "22/09/26".
  const shortYearMatch = raw.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2})$/)
  if (shortYearMatch) {
    const [, d, m, y] = shortYearMatch
    return buildIso(2000 + Number(y), Number(m), Number(d))
  }

  const parsed = new Date(raw)
  if (
    !Number.isNaN(parsed.getTime()) &&
    parsed.getFullYear() > 1900 &&
    parsed.getFullYear() <= new Date().getFullYear()
  ) {
    return toIsoDate(parsed)
  }
  return null
}

function buildIso(year: number, month: number, day: number): string | null {
  if (year < 1900 || month < 1 || month > 12 || day < 1 || day > 31) return null
  const date = new Date(Date.UTC(year, month - 1, day))
  if (date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null
  return date.toISOString().slice(0, 10)
}

function toIsoDate(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

// ---------------------------------------------------------------------------
// Format B - the physical PRPS admission form (labelled fields, no table)
// ---------------------------------------------------------------------------

interface FormParagraph {
  text: string
  /** Raw paragraph XML - carries legacy / content-control checkbox state. */
  xml: string
}

function unescapeXml(value: string): string {
  return value
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCodePoint(Number.parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(Number(dec)))
    .replace(/&amp;/g, '&')
}

/**
 * Reads every paragraph of `word/document.xml` straight from the OPC package.
 * Field instructions (`FORMCHECKBOX`) and deleted text are skipped; text runs,
 * tabs and line breaks are concatenated in document order. Paragraphs inside
 * tables are included, so a form laid out with table borders still parses.
 * Returns null when the package is not a readable .docx.
 */
export async function readDocxParagraphs(buffer: Buffer): Promise<FormParagraph[] | null> {
  try {
    const zip = await JSZip.loadAsync(buffer)
    const entry = zip.file('word/document.xml')
    if (!entry) return null
    const xml = await entry.async('string')
    const blocks = xml.match(/<w:p(?:\s[^>]*)?>[\s\S]*?<\/w:p>|<w:p(?:\s[^>]*)?\/>/g) ?? []
    return blocks.map((block) => {
      const inner = block
        .replace(/<w:instrText[\s\S]*?<\/w:instrText>/g, '')
        .replace(/<w:delText[\s\S]*?<\/w:delText>/g, '')
      const run = /<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>|<w:tab(?:\s[^>]*)?\/>|<w:br(?:\s[^>]*)?\/>/g
      let text = ''
      let match: RegExpExecArray | null
      while ((match = run.exec(inner)) !== null) {
        text += match[1] !== undefined ? unescapeXml(match[1]) : ' '
      }
      return { text: text.replace(/\s+/g, ' ').trim(), xml: block }
    })
  } catch {
    return null
  }
}

/**
 * Checkbox state carried by the paragraph XML itself:
 *   - Word content-control checkboxes (`w14:checkbox`) with an explicit
 *     `w14:checked` value.
 *   - Legacy Word form-field checkboxes (`w:checkBox` / `w:checked`).
 * Returns null when the paragraph carries no interpretable checkbox.
 */
function paragraphCheckboxState(xml: string): boolean | null {
  if (/w14:checkbox/i.test(xml)) {
    const checked = xml.match(/<w14:checked[^>]*w14:val="([^"]+)"/)
    if (checked) return checked[1] === '1' || /^true$/i.test(checked[1])
    return null
  }
  if (/<w:checkBox[\s>]/i.test(xml)) {
    const checked = xml.match(/<w:checked\s[^>]*w:val="([^"]+)"/)
    if (checked) return /^(true|1|on)$/i.test(checked[1])
    return false
  }
  return null
}

/**
 * Interprets the tick beside one "UNIFORMS SUPPLIED" item. Supported marks:
 * Word checkbox controls (both content-control and legacy form fields),
 * checkbox / tick / cross characters, bracketed `[x]` marks, a trailing `x`,
 * and plain text such as "Yes" / "Supplied" / "No". Anything else is
 * reported as UNKNOWN so the Headteacher confirms it in the preview instead
 * of the system silently guessing the wrong status.
 */
export function resolveUniformStatus(
  text: string,
  xml: string,
): 'COLLECTED' | 'NOT_COLLECTED' | 'UNKNOWN' {
  const checkbox = paragraphCheckboxState(xml)
  if (checkbox !== null) return checkbox ? 'COLLECTED' : 'NOT_COLLECTED'

  if (/[☑✓✔☒]/.test(text)) return 'COLLECTED'
  if (/[☐□▢⬜]/.test(text)) return 'NOT_COLLECTED'
  if (/\[[xX]\]|\([xX]\)/.test(text)) return 'COLLECTED'
  if (/\[[\s\u00A0]\]|\([\s\u00A0]\)/.test(text)) return 'NOT_COLLECTED'

  const trimmed = text.replace(/\s+/g, ' ').trim()
  if (/[:.\-–—]\s*[xX]$/.test(trimmed) || /\s[xX]$/.test(trimmed)) return 'COLLECTED'

  const normalized = trimmed.toLowerCase().replace(/[.?]+$/, '').trim()
  if (UNIFORM_COLLECTED_VALUES.has(normalized)) return 'COLLECTED'
  if (UNIFORM_NOT_COLLECTED_VALUES.has(normalized)) return 'NOT_COLLECTED'
  if (/(^|\s)(no|not supplied|unticked|unsupplied)(\s|$)/.test(normalized)) return 'NOT_COLLECTED'
  if (/(^|\s)(yes|supplied|ticked)(\s|$)/.test(normalized)) return 'COLLECTED'
  return 'UNKNOWN'
}

/** Normalises a form label for lookup: "ADMISSION NO." -> "admissionno". */
function normalizeFormLabel(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '')
}

/**
 * Labelled-field aliases of the physical PRPS admission form. Unknown labels
 * never invent fields -- they are either continuations of the previous value
 * or plain document noise (headings, boxes, signatures).
 */
const FORM_LABELS: Record<string, string> = {
  nameofchild: 'nameOfChild',
  childname: 'nameOfChild',
  nameofpupil: 'nameOfChild',
  dateofadmission: 'dateOfAdmission',
  admissiondate: 'dateOfAdmission',
  dateofbirth: 'dateOfBirth',
  dob: 'dateOfBirth',
  classseeking: 'classSeeking',
  classseekingfor: 'classSeeking',
  class: 'classSeeking',
  grade: 'classSeeking',
  schoolattended: 'schoolAttended',
  previousschool: 'schoolAttended',
  schoolpreviouslyattended: 'schoolAttended',
  reasonforjoiningschool: 'reasonForJoining',
  reasonforchoosingthisschool: 'reasonForJoining',
  reasonforchoosingschool: 'reasonForJoining',
  reason: 'reasonForJoining',
  housenumber: 'houseNumber',
  house: 'houseNumber',
  nationality: 'nationality',
  religion: 'religion',
  gender: 'gender',
  sex: 'gender',
  fathersname: 'fatherName',
  fathername: 'fatherName',
  fathersfullname: 'fatherName',
  father: 'fatherName',
  mothersname: 'motherName',
  mothername: 'motherName',
  mothersfullname: 'motherName',
  mother: 'motherName',
  occupation: 'occupation',
  address: 'address',
  staywiththechild: 'stayWithChild',
  staywithchild: 'stayWithChild',
  livingarrangement: 'stayWithChild',
  guardiansdeclaration: 'declaration',
  guardiandeclaration: 'declaration',
  declaration: 'declaration',
  declarationtext: 'declaration',
  officeuse: 'officeUse',
  admissionno: 'admissionNumber',
  admissionnumber: 'admissionNumber',
  payment: 'payment',
  admissionpayment: 'payment',
  admissionfee: 'payment',
  sheetno: 'sheetNumber',
  sheetnumber: 'sheetNumber',
  sheet: 'sheetNumber',
  uniformssupplied: 'uniforms',
  academicyear: 'academicYear',
}

export type ParsedUniformTickStatus = 'COLLECTED' | 'NOT_COLLECTED' | 'UNKNOWN'

export interface ParsedAdmissionForm {
  nameOfChild: string
  dateOfAdmission: string
  dateOfBirth: string
  gender: string
  classSeeking: string
  schoolAttended: string
  reasonForJoining: string
  houseNumber: string
  nationality: string
  religion: string
  fatherName: string
  fatherOccupation: string
  fatherAddress: string
  stayWithChild: string
  motherName: string
  motherAddress: string
  motherOccupation: string
  declarationText: string
  admissionNumber: string
  payment: string
  sheetNumber: string
  uniforms: Array<{ slot: number; name: string; status: ParsedUniformTickStatus }>
  uniformsSectionSeen: boolean
}

/**
 * Extracts the labelled fields of one PRPS admission form. The father / mother
 * sections are tracked positionally: OCCUPATION and ADDRESS belong to the
 * father until MOTHER'S NAME is seen, and to the mother afterwards, matching
 * the printed order of the physical document. Multi-line values are rejoined.
 */
export function parseAdmissionForm(paragraphs: FormParagraph[]): ParsedAdmissionForm {
  const values: Record<string, string> = {}
  const uniforms = new Map<number, { slot: number; name: string; status: ParsedUniformTickStatus }>()
  let currentKey: string | null = null
  let parent: 'father' | 'mother' | null = null
  let uniformsSectionSeen = false

  const setValue = (key: string, value: string) => {
    const existing = values[key]
    values[key] = existing && existing !== '' ? `${existing} ${value}` : value
  }

  const recordUniform = (item: { slot: number; name: string }, status: ParsedUniformTickStatus) => {
    const previous = uniforms.get(item.slot)
    if (!previous || (previous.status === 'UNKNOWN' && status !== 'UNKNOWN')) {
      uniforms.set(item.slot, { slot: item.slot, name: item.name, status })
    }
  }

  for (const paragraph of paragraphs) {
    const text = clean(paragraph.text)
    if (text === '') continue
    const lower = text.toLowerCase()

    if (/uniforms?\s+supplied/i.test(text)) {
      uniformsSectionSeen = true
      currentKey = null
      continue
    }
    if (/^office\s+use\b/i.test(text)) {
      currentKey = null
      continue
    }

    const numberedItem = /^\d+\s*[.)]/.test(text)
    const uniformItem = (uniformsSectionSeen || numberedItem
      ? ADMISSION_UNIFORM_ITEMS
      : []
    ).find((item) => lower.includes(item.name.toLowerCase()))
    if (uniformItem) {
      uniformsSectionSeen = uniformsSectionSeen || numberedItem
      recordUniform(uniformItem, resolveUniformStatus(text, paragraph.xml))
      currentKey = null
      continue
    }

    const colon = text.indexOf(':')
    if (colon > 0 && colon <= 60) {
      const label = normalizeFormLabel(text.slice(0, colon))
      const rest = text.slice(colon + 1).trim()

      const uniformByLabel = ADMISSION_UNIFORM_ITEMS.find(
        (item) => normalizeFormLabel(item.name) === label,
      )
      if (uniformByLabel) {
        uniformsSectionSeen = true
        recordUniform(uniformByLabel, resolveUniformStatus(rest, paragraph.xml))
        currentKey = null
        continue
      }

      const key = FORM_LABELS[label]
      if (key) {
        if (key === 'uniforms') {
          uniformsSectionSeen = true
          currentKey = null
          continue
        }
        if (key === 'officeUse' || key === 'academicYear') {
          currentKey = null
          continue
        }
        if (key === 'fatherName') parent = 'father'
        if (key === 'motherName') parent = 'mother'
        let target = key
        if (key === 'occupation') target = parent === 'mother' ? 'motherOccupation' : 'fatherOccupation'
        if (key === 'address') target = parent === 'mother' ? 'motherAddress' : 'fatherAddress'
        currentKey = target
        setValue(target, rest)
        continue
      }
    }

    if (currentKey !== null) setValue(currentKey, text)
  }

  return {
    nameOfChild: values.nameOfChild ?? '',
    dateOfAdmission: values.dateOfAdmission ?? '',
    dateOfBirth: values.dateOfBirth ?? '',
    gender: values.gender ?? '',
    classSeeking: values.classSeeking ?? '',
    schoolAttended: values.schoolAttended ?? '',
    reasonForJoining: values.reasonForJoining ?? '',
    houseNumber: values.houseNumber ?? '',
    nationality: values.nationality ?? '',
    religion: values.religion ?? '',
    fatherName: values.fatherName ?? '',
    fatherOccupation: values.fatherOccupation ?? '',
    fatherAddress: values.fatherAddress ?? '',
    stayWithChild: values.stayWithChild ?? '',
    motherName: values.motherName ?? '',
    motherAddress: values.motherAddress ?? '',
    motherOccupation: values.motherOccupation ?? '',
    declarationText: values.declaration ?? '',
    admissionNumber: values.admissionNumber ?? '',
    payment: values.payment ?? '',
    sheetNumber: values.sheetNumber ?? '',
    uniforms: ADMISSION_UNIFORM_ITEMS.map(
      (item) => uniforms.get(item.slot) ?? { slot: item.slot, name: item.name, status: 'UNKNOWN' as const },
    ),
    uniformsSectionSeen,
  }
}

/**
 * True when the document text is the labelled PRPS admission form rather than
 * the one-pupil-per-row table. The colon-terminated `NAME OF CHILD:` label is
 * what distinguishes it from a table header such as "Name of Child".
 */
export function looksLikeAdmissionForm(paragraphs: FormParagraph[]): boolean {
  const text = paragraphs.map((paragraph) => paragraph.text).join('\n')
  if (!/NAME\s+OF\s+CHILD\s*:/i.test(text)) return false
  return /ADMISSION\s+FORM/i.test(text) || /CLASS\s+SEEKING\s*:/i.test(text)
}

/**
 * Splits a document that contains several printed admission forms (one per
 * pupil) into one paragraph list per form. Boundaries are the repeated
 * `NAME OF CHILD:` lines: everything from one such line up to the next
 * belongs to the same form.
 */
export function splitAdmissionFormParagraphs(paragraphs: FormParagraph[]): FormParagraph[][] {
  const starts: number[] = []
  paragraphs.forEach((paragraph, index) => {
    if (/^\s*NAME\s+OF\s+CHILD\s*:/i.test(paragraph.text)) starts.push(index)
  })
  if (starts.length === 0) return [paragraphs]
  if (starts.length > MAX_IMPORT_ROWS) {
    throw new AppError(`A maximum of ${MAX_IMPORT_ROWS} pupils can be imported per document.`, HttpStatus.BadRequest)
  }

  const chunks: FormParagraph[][] = []
  let formStart = 0
  for (let i = 1; i < starts.length; i += 1) {
    chunks.push(paragraphs.slice(formStart, starts[i]))
    formStart = starts[i]
  }
  chunks.push(paragraphs.slice(formStart))
  return chunks.filter((chunk) => chunk.length > 0)
}

/**
 * Splits a guardian ADDRESS value using the actual value: a phone-only value
 * goes to `phone`, anything else stays in `address`, and a value that mixes
 * text with a phone number keeps BOTH so no information is lost.
 */
export function splitGuardianContact(value: string): { phone: string | null; address: string | null } {
  const raw = clean(value)
  if (raw === '') return { phone: null, address: null }
  const compact = raw.replace(/[\s()-]/g, '')
  const digitCount = (raw.match(/\d/g) ?? []).length
  if (/^\+?\d+$/.test(compact) && digitCount >= 9) return { phone: raw, address: null }
  const embedded = raw.match(/\+?\d[\d\s()-]{7,}\d/)
  if (embedded && embedded[0].replace(/\D/g, '').length >= 9) {
    return { phone: embedded[0].trim(), address: raw }
  }
  return { phone: null, address: raw }
}

// ---------------------------------------------------------------------------
// Preview (both formats share one draft shape -> one confirmation payload)
// ---------------------------------------------------------------------------

interface DuplicateMatch {
  pupilId: string
  fullName: string
  dateOfBirthIso: string
}

async function findDuplicateCandidates(
  rows: Array<{ firstName: string; lastName: string; dateOfBirth: string | null }>,
): Promise<DuplicateMatch[]> {
  const namePairs = new Map<string, { firstName: string; lastName: string }>()
  for (const row of rows) {
    if (!row.firstName || !row.lastName) continue
    const key = `${row.firstName.toLowerCase()}|${row.lastName.toLowerCase()}`
    if (!namePairs.has(key)) {
      namePairs.set(key, { firstName: row.firstName, lastName: row.lastName })
    }
  }
  if (namePairs.size === 0) return []

  const orConditions = Array.from(namePairs.values()).map((pair) => ({
    firstName: { equals: pair.firstName, mode: 'insensitive' as const },
    lastName: { equals: pair.lastName, mode: 'insensitive' as const },
  }))

  const existing = await prisma.pupil.findMany({
    where: { OR: orConditions },
    select: {
      pupilId: true,
      firstName: true,
      lastName: true,
      dateOfBirth: true,
    },
    take: 500,
  })

  return existing.map((pupil) => ({
    pupilId: pupil.pupilId,
    fullName: `${pupil.firstName} ${pupil.lastName}`,
    dateOfBirthIso: toIsoDate(pupil.dateOfBirth),
  }))
}

/** Normalised pupil-registration draft - identical for both formats. */
interface Draft {
  rowNumber: number
  firstName: string
  middleName: string
  lastName: string
  dateOfBirth: string | null
  gender: PupilGender | null
  classId: string | null
  classLabel: string
  dateAdmitted: string | null
  address: string
  previousSchool: string
  stayWithChild: string
  nationality: string
  religion: string
  admissionReason: string
  declarationAcknowledged: boolean
  admissionNumber: string
  sheetNumber: string
  admissionFeeCell: string
  admissionFee: ParsedAdmissionFee
  uniforms: ParsedUniform[]
  guardians: PImportGuardian[]
  /** Non-blocking notices (e.g. unreadable uniform ticks) - not errors. */
  warnings: string[]
  messages: string[]
}

interface DraftInput {
  rowNumber: number
  firstName: string
  middleName?: string
  lastName: string
  dateOfBirthRaw: string
  genderRaw: string
  classRaw: string
  dateAdmittedRaw?: string
  address?: string
  previousSchool?: string
  stayWithChild?: string
  nationality?: string
  religion?: string
  admissionReason?: string
  declarationAcknowledged?: boolean
  admissionNumber?: string
  sheetNumber?: string
  admissionFeeCell?: string
  uniforms: ParsedUniform[]
  guardians: PImportGuardian[]
  warnings?: string[]
}

/**
 * Shared validation + class resolution for both document formats. Messages
 * are identical whichever parser produced the draft, so preview correction,
 * duplicate detection and confirmation behave the same everywhere.
 */
function makeDraft(
  input: DraftInput,
  classByName: Map<string, { id: string; name: string }>,
): Draft {
  const messages: string[] = []
  const firstName = clean(input.firstName)
  const middleName = clean(input.middleName ?? '')
  const lastName = clean(input.lastName)

  if (firstName === '') messages.push('First name is required.')
  else if (firstName.length < 2) messages.push('First name must be at least 2 characters.')

  if (lastName === '') messages.push('Last name is required.')
  else if (lastName.length < 2) messages.push('Last name must be at least 2 characters.')

  const dateOfBirthRaw = clean(input.dateOfBirthRaw)
  const dateOfBirth = parseDateOfBirth(dateOfBirthRaw)
  if (dateOfBirthRaw === '') messages.push('Date of birth is required.')
  else if (!dateOfBirth) messages.push('Date of birth is not a valid date.')
  else if (new Date(dateOfBirth).getTime() > Date.now()) messages.push('Date of birth cannot be in the future.')

  const genderRaw = clean(input.genderRaw)
  const gender = parseGender(genderRaw)
  if (genderRaw === '') messages.push('Gender is required.')
  else if (!gender) messages.push('Gender must be Male or Female.')

  const classRaw = clean(input.classRaw)
  let classId: string | null = null
  let classLabel = classRaw
  if (classRaw === '') {
    messages.push('Class is required.')
    classLabel = '(missing)'
  } else {
    const match = classByName.get(classRaw.toLowerCase())
    if (match) {
      classId = match.id
      classLabel = match.name
    } else {
      messages.push('Class not found')
    }
  }

  for (const guardian of input.guardians) {
    if (guardian.fullName !== '' && guardian.fullName.length < 2) {
      messages.push('Guardian name must be at least 2 characters.')
      break
    }
  }

  const admissionNumber = clean(input.admissionNumber ?? '')
  if (admissionNumber.length > MAX_ADMISSION_NUMBER_LENGTH) {
    messages.push('Admission number is too long.')
  }

  const sheetNumber = clean(input.sheetNumber ?? '')
  if (sheetNumber.length > MAX_SHEET_NUMBER_LENGTH) {
    messages.push('Sheet number is too long.')
  }

  const admissionFeeCell = clean(input.admissionFeeCell ?? '')
  const admissionFee = parseAdmissionFee(admissionFeeCell)
  if (admissionFee.status === 'invalid') {
    messages.push('Admission fee is not a valid amount.')
  }

  const uniforms = input.uniforms
  if (uniforms.some((item) => item.label !== null && item.label.length > MAX_UNIFORM_LABEL_LENGTH)) {
    messages.push('A uniform label is too long.')
  }

  return {
    rowNumber: input.rowNumber,
    firstName,
    middleName,
    lastName,
    dateOfBirth,
    gender,
    classId,
    classLabel,
    dateAdmitted: parseDateOfBirth(clean(input.dateAdmittedRaw ?? '')),
    address: clean(input.address ?? ''),
    previousSchool: clean(input.previousSchool ?? ''),
    stayWithChild: clean(input.stayWithChild ?? ''),
    nationality: clean(input.nationality ?? ''),
    religion: clean(input.religion ?? ''),
    admissionReason: clean(input.admissionReason ?? ''),
    declarationAcknowledged: input.declarationAcknowledged ?? false,
    admissionNumber,
    sheetNumber,
    admissionFeeCell,
    admissionFee,
    uniforms,
    guardians: input.guardians,
    warnings: input.warnings ?? [],
    messages,
  }
}

/** Format A: one pupil per table row. */
function draftFromTableRow(
  row: string[],
  index: number,
  columnIndex: Partial<Record<ColumnKey, number>>,
  missingRequired: ColumnKey[],
  classByName: Map<string, { id: string; name: string }>,
): Draft {
  const cellAt = (key: ColumnKey): string => {
    const column = columnIndex[key]
    if (column === undefined) return ''
    return clean(row[column])
  }

  const guardianName = cellAt('guardianName')
  const guardians: PImportGuardian[] =
    guardianName !== ''
      ? [
          {
            fullName: guardianName,
            phone: optional(cellAt('guardianPhone')) ?? null,
            address: optional(cellAt('address')) ?? null,
            occupation: optional(cellAt('guardianOccupation')) ?? null,
            relationship: optional(cellAt('guardianRelationship')) ?? null,
            isPrimary: true,
            isEmergency: true,
          },
        ]
      : []

  // A missing required column behaves exactly like an empty cell.
  const present = (key: ColumnKey, value: string): string =>
    missingRequired.includes(key) && value === '' ? '' : value

  return makeDraft(
    {
      rowNumber: index + 1,
      firstName: present('firstName', cellAt('firstName')),
      middleName: cellAt('middleName'),
      lastName: present('lastName', cellAt('lastName')),
      dateOfBirthRaw: present('dateOfBirth', cellAt('dateOfBirth')),
      genderRaw: present('gender', cellAt('gender')),
      classRaw: present('class', cellAt('class')),
      dateAdmittedRaw: cellAt('dateAdmitted'),
      address: cellAt('address'),
      previousSchool: cellAt('previousSchool'),
      stayWithChild: cellAt('stayWithChild'),
      nationality: cellAt('nationality'),
      religion: cellAt('religion'),
      admissionReason: cellAt('admissionReason'),
      admissionNumber: cellAt('admissionNumber'),
      sheetNumber: cellAt('sheetNumber'),
      admissionFeeCell: cellAt('admissionFee'),
      uniforms: UNIFORM_COLUMNS.map((column, uniformIndex) =>
        parseUniformCell(uniformIndex + 1, cellAt(column)),
      ),
      guardians,
    },
    classByName,
  )
}

/** Format B: one PRPS admission-form document section. */
function draftFromAdmissionForm(
  form: ParsedAdmissionForm,
  index: number,
  classByName: Map<string, { id: string; name: string }>,
): Draft {
  const nameTokens = clean(form.nameOfChild).split(/\s+/).filter(Boolean)
  const firstName = nameTokens[0] ?? ''
  const lastName = nameTokens.length >= 2 ? nameTokens[nameTokens.length - 1] : ''
  const middleName = nameTokens.length > 2 ? nameTokens.slice(1, -1).join(' ') : ''

  const fatherContact = splitGuardianContact(form.fatherAddress)
  const motherContact = splitGuardianContact(form.motherAddress)
  const guardians: PImportGuardian[] = []
  if (form.fatherName !== '') {
    guardians.push({
      fullName: form.fatherName,
      relationship: 'Father',
      phone: fatherContact.phone,
      address: fatherContact.address,
      occupation: optional(form.fatherOccupation) ?? null,
      isPrimary: true,
      isEmergency: form.motherName === '',
    })
  }
  if (form.motherName !== '') {
    guardians.push({
      fullName: form.motherName,
      relationship: 'Mother',
      phone: motherContact.phone,
      address: motherContact.address,
      occupation: optional(form.motherOccupation) ?? null,
      isPrimary: form.fatherName === '',
      isEmergency: form.fatherName !== '',
    })
  }

  const uniforms: ParsedUniform[] = form.uniforms.map((item) => ({
    slot: item.slot,
    label: item.name,
    status: item.status === 'COLLECTED' ? 'COLLECTED' : 'NOT_COLLECTED',
  }))

  const warnings: string[] = []
  if (!form.uniformsSectionSeen) {
    warnings.push('The Uniforms Supplied section was not found - confirm the uniform statuses.')
  } else if (form.uniforms.some((item) => item.status === 'UNKNOWN')) {
    warnings.push('Confirm the uniform supplied statuses before registering.')
  }

  return makeDraft(
    {
      rowNumber: index + 1,
      firstName,
      middleName,
      lastName,
      dateOfBirthRaw: form.dateOfBirth,
      genderRaw: form.gender,
      classRaw: form.classSeeking,
      dateAdmittedRaw: form.dateOfAdmission,
      address: form.houseNumber,
      previousSchool: form.schoolAttended,
      stayWithChild: form.stayWithChild,
      nationality: form.nationality,
      religion: form.religion,
      admissionReason: form.reasonForJoining,
      declarationAcknowledged: form.declarationText.trim() !== '',
      admissionNumber: form.admissionNumber,
      sheetNumber: form.sheetNumber,
      admissionFeeCell: form.payment,
      uniforms,
      guardians,
      warnings,
    },
    classByName,
  )
}

async function loadClassMap(): Promise<Map<string, { id: string; name: string }>> {
  // Load ACTIVE classes once; resolve names case-insensitively against the
  // unique `SchoolClass.name` (e.g. "Basic 3A"). Never creates classes.
  const classes = await prisma.schoolClass.findMany({
    where: { status: 'ACTIVE' },
    select: { id: true, name: true },
  })
  const classByName = new Map<string, { id: string; name: string }>()
  for (const klass of classes) {
    classByName.set(klass.name.toLowerCase(), klass)
  }
  return classByName
}

/**
 * Parses + validates a Word upload into a preview. **Never writes to the
 * database** -- no pupils, guardians or audit rows are created here.
 *
 * Format detection: the labelled PRPS admission form wins when the document
 * carries `NAME OF CHILD:` labels; otherwise the original table import runs
 * unchanged for backwards compatibility.
 */
export async function previewPupilImport(file: {
  originalname: string
  mimetype: string
  size: number
  buffer: Buffer
}): Promise<PupilImportPreview> {
  assertUsableDocxUpload(file)

  const classByName = await loadClassMap()

  const paragraphs = await readDocxParagraphs(file.buffer)
  const isAdmissionForm = paragraphs !== null && looksLikeAdmissionForm(paragraphs)

  let sourceFormat: ImportSourceFormat = 'TABLE'
  let drafts: Draft[]

  if (isAdmissionForm && paragraphs) {
    sourceFormat = 'FORM'
    const forms = splitAdmissionFormParagraphs(paragraphs)
    drafts = forms.map((formParagraphs, index) =>
      draftFromAdmissionForm(parseAdmissionForm(formParagraphs), index, classByName),
    )
  } else {
    const table = await extractTableFromDocx(file.buffer)
    const { columnIndex, missingRequired, recognizedCount } = mapColumns(table.headers)

    if (recognizedCount === 0 || missingRequired.length === REQUIRED_COLUMNS.length) {
      throw new AppError(
        `Could not identify the required column headings. Expected columns such as: ${REQUIRED_COLUMNS.map((key) => REQUIRED_COLUMN_LABELS[key]).join(', ')}, or a PRPS admission form with labelled fields (NAME OF CHILD:, DATE OF BIRTH:, CLASS SEEKING:...).`,
        HttpStatus.BadRequest,
      )
    }

    drafts = table.rows.map((row, index) =>
      draftFromTableRow(row, index, columnIndex, missingRequired, classByName),
    )
  }

  const duplicates = await findDuplicateCandidates(drafts)
  const byName = new Map<string, DuplicateMatch[]>()
  for (const match of duplicates) {
    const key = match.fullName.toLowerCase()
    const list = byName.get(key) ?? []
    list.push(match)
    byName.set(key, list)
  }

  const seenInDocument = new Map<string, number>()

  const rows: PupilImportPreviewRow[] = drafts.map((draft) => {
    const messages = [...draft.messages]
    let status: ImportRowStatus = draft.messages.length > 0 ? 'ERROR' : 'VALID'
    let duplicateOf: PupilImportPreviewRow['duplicateOf'] = null

    const fullName =
      clean(`${draft.firstName} ${draft.middleName} ${draft.lastName}`) ||
      clean(`${draft.firstName} ${draft.lastName}`) ||
      '(incomplete row)'

    if (draft.firstName && draft.lastName && draft.dateOfBirth) {
      const identityKey = `${draft.firstName.toLowerCase()}|${draft.lastName.toLowerCase()}|${draft.dateOfBirth}`
      const firstSeenRow = seenInDocument.get(identityKey)
      if (firstSeenRow !== undefined) {
        if (status === 'VALID') status = 'DUPLICATE'
        messages.push(`Duplicate of row ${firstSeenRow} in this document.`)
      } else {
        seenInDocument.set(identityKey, draft.rowNumber)
      }

      const nameKey = `${draft.firstName} ${draft.lastName}`.toLowerCase()
      const nameMatches = byName.get(nameKey) ?? []
      const exactMatch = nameMatches.find((match) => match.dateOfBirthIso === draft.dateOfBirth)
      if (exactMatch) {
        duplicateOf = { pupilId: exactMatch.pupilId, fullName: exactMatch.fullName }
        if (status !== 'ERROR') status = 'DUPLICATE'
        messages.push(`Already registered as ${exactMatch.pupilId} (${exactMatch.fullName}).`)
      } else if (nameMatches.length > 0) {
        if (status === 'VALID') status = 'WARNING'
        messages.push('A pupil with a similar name already exists - please verify this is not a duplicate.')
      }
    }

    if (status === 'VALID' && draft.warnings.length > 0) status = 'WARNING'

    const firstGuardian = draft.guardians[0] ?? null

    return {
      rowNumber: draft.rowNumber,
      status,
      messages,
      warnings: draft.warnings,
      correctableClass:
        status === 'ERROR' && messages.length > 0 && messages.every((message) => CLASS_ONLY_MESSAGES.has(message)),
      correctable:
        status === 'ERROR' &&
        messages.length > 0 &&
        messages.every((message) => CORRECTABLE_MESSAGES.has(message)),
      fullName,
      data: {
        firstName: draft.firstName,
        middleName: optional(draft.middleName) ?? null,
        lastName: draft.lastName,
        dateOfBirth: draft.dateOfBirth,
        gender: draft.gender,
        classId: draft.classId,
        classLabel: draft.classLabel,
        dateAdmitted: draft.dateAdmitted,
        address: optional(draft.address) ?? null,
        previousSchool: optional(draft.previousSchool) ?? null,
        stayWithChild: optional(draft.stayWithChild) ?? null,
        nationality: optional(draft.nationality) ?? null,
        religion: optional(draft.religion) ?? null,
        admissionReason: optional(draft.admissionReason) ?? null,
        declarationAcknowledged: draft.declarationAcknowledged,
        admissionNumber: optional(draft.admissionNumber) ?? null,
        sheetNumber: optional(draft.sheetNumber) ?? null,
        admissionFee:
          draft.admissionFee.status === 'ok'
            ? draft.admissionFee.value
            : draft.admissionFee.status === 'invalid'
              ? draft.admissionFeeCell
              : null,
        uniforms: draft.uniforms,
        guardians: draft.guardians,
        guardian: firstGuardian
          ? {
              fullName: firstGuardian.fullName,
              phone: firstGuardian.phone,
              address: firstGuardian.address,
              occupation: firstGuardian.occupation,
              relationship: firstGuardian.relationship,
            }
          : null,
      },
      duplicateOf,
    }
  })

  return {
    sourceFormat,
    totalRows: rows.length,
    validCount: rows.filter((row) => row.status === 'VALID').length,
    warningCount: rows.filter((row) => row.status === 'WARNING').length,
    duplicateCount: rows.filter((row) => row.status === 'DUPLICATE').length,
    errorCount: rows.filter((row) => row.status === 'ERROR').length,
    rows,
  }
}

// ---------------------------------------------------------------------------
// Confirm -- reuses createPupil per row (no second registration implementation)
// ---------------------------------------------------------------------------

export interface PupilImportConfirmRow extends PupilCreateInput {
  rowNumber: number
}

/**
 * Registers the confirmed rows. Each pupil goes through the existing
 * `createPupil` service inside its own transaction, so one failed record
 * never leaves a half-created sibling behind and never blocks the others
 * (partial import). Exact name+DOB matches against existing pupils are
 * skipped, which makes a repeated Confirm click idempotent.
 */
export async function confirmPupilImport(
  actor: AuthenticatedUser,
  pupils: PupilImportConfirmRow[],
  ip?: string,
): Promise<PupilImportConfirmResult> {
  if (pupils.length === 0) {
    throw new AppError('Select at least one pupil to register.', HttpStatus.BadRequest)
  }
  if (pupils.length > MAX_IMPORT_ROWS) {
    throw new AppError(`A maximum of ${MAX_IMPORT_ROWS} pupils can be imported at once.`, HttpStatus.BadRequest)
  }

  const results: PupilImportConfirmResult['results'] = []
  let created = 0
  let skipped = 0
  let failed = 0

  for (const row of pupils) {
    const fullName = clean(`${row.firstName} ${row.lastName}`) || `Row ${row.rowNumber}`
    try {
      // Class must exist -- same rule as manual registration (never auto-create).
      const classRecord = await prisma.schoolClass.findUnique({ where: { id: row.classId } })
      if (!classRecord) {
        skipped += 1
        results.push({ rowNumber: row.rowNumber, fullName, status: 'SKIPPED', reason: 'Class not found' })
        continue
      }

      // Idempotency: skip exact identity already in the DB (double-click, re-upload).
      const dobIso = parseDateOfBirth(row.dateOfBirth) ?? clean(row.dateOfBirth)
      const existing = await prisma.pupil.findFirst({
        where: {
          firstName: { equals: row.firstName.trim(), mode: 'insensitive' },
          lastName: { equals: row.lastName.trim(), mode: 'insensitive' },
          dateOfBirth: dobIso ? new Date(`${dobIso}T00:00:00.000Z`) : undefined,
        },
        select: { pupilId: true },
      })
      if (existing) {
        skipped += 1
        results.push({
          rowNumber: row.rowNumber,
          fullName,
          status: 'SKIPPED',
          pupilId: existing.pupilId,
          reason: `Already registered as ${existing.pupilId}`,
        })
        continue
      }

      const { rowNumber: _rowNumber, ...createInput } = row
      const pupil = await createPupil(actor, createInput, ip)
      created += 1
      results.push({ rowNumber: row.rowNumber, fullName, status: 'CREATED', pupilId: pupil.pupilId })
    } catch (err) {
      failed += 1
      const reason =
        err instanceof AppError ? err.message : err instanceof Error ? err.message : 'Registration failed.'
      results.push({ rowNumber: row.rowNumber, fullName, status: 'FAILED', reason })
    }
  }

  await recordAudit({
    actorUserId: actor.id,
    action: 'pupil.import_word',
    resourceType: 'pupil',
    resourceId: null,
    metadata: {
      source: 'word_import',
      attempted: pupils.length,
      created,
      skipped,
      failed,
      failures: results
        .filter((result) => result.status !== 'CREATED')
        .map((result) => ({ rowNumber: result.rowNumber, status: result.status, reason: result.reason ?? null })),
    },
    ip: ip ?? null,
  })

  return { total: pupils.length, created, skipped, failed, results }
}

// ---------------------------------------------------------------------------
// Template (.docx) generation
// ---------------------------------------------------------------------------

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function paragraphXml(text: string, bold = false): string {
  const runProps = bold ? '<w:rPr><w:b/></w:rPr>' : ''
  return `<w:p><w:r>${runProps}<w:t xml:space="preserve">${escapeXml(text)}</w:t></w:r></w:p>`
}

/** Instructions carry no colon-labelled fields, so they never feed the parser. */
const TEMPLATE_INSTRUCTIONS =
  'HOW TO FILL - type the answer straight after each colon, keep every printed label exactly as it is, and delete nothing. ' +
  'One block of fields is one pupil, so copy the whole block when you fill in another child. ' +
  'Leave a blank when a field does not apply. Gender must be Male or Female, dates may be written as 28/10/24, ' +
  'and the class must be an existing class such as Basic 3. In the list of uniforms at the end, tick the box ' +
  'beside every uniform issued, or write Yes or No. Save the file, then upload it from Pupils, Import from Word.'

/** The printed PRPS admission form, in the exact order of the physical document. */
const TEMPLATE_FORM_LINES: ReadonlyArray<{ text: string; bold?: boolean }> = [
  { text: 'PRIME ROYAL PREPARATORY SCHOOL', bold: true },
  { text: 'P. O. BOX SE 724, ATIMATIM - KUMASI' },
  { text: 'ADMISSION FORM - PRI - SCHOOL', bold: true },
  { text: TEMPLATE_INSTRUCTIONS },
  { text: 'NAME OF CHILD:' },
  { text: 'DATE OF ADMISSION:' },
  { text: 'DATE OF BIRTH:' },
  { text: 'GENDER:' },
  { text: 'CLASS SEEKING:' },
  { text: 'SCHOOL ATTENDED:' },
  { text: 'REASON FOR JOINING SCHOOL:' },
  { text: 'HOUSE NUMBER:' },
  { text: 'NATIONALITY:' },
  { text: 'RELIGION:' },
  { text: "FATHER'S NAME:" },
  { text: 'OCCUPATION:' },
  { text: 'ADDRESS:' },
  { text: 'STAY WITH THE CHILD:' },
  { text: "MOTHER'S NAME:" },
  { text: 'ADDRESS:' },
  { text: 'OCCUPATION:' },
  { text: "GUARDIAN'S DECLARATION: I confirm that the particulars given on this form are true and correct." },
  { text: 'OFFICE USE', bold: true },
  { text: 'ADMISSION NO.:' },
  { text: 'PAYMENT:' },
  { text: 'SHEET NO.:' },
  { text: 'UNIFORMS SUPPLIED (TICK WHERE APPROPRIATE)', bold: true },
  ...ADMISSION_UNIFORM_ITEMS.map((item) => ({ text: `${item.name} \u2610` })),
]

/**
 * Builds the PRPS admission form itself as a minimal valid .docx, so the
 * template the Headteacher downloads is exactly the form the school prints
 * and later uploads - it round-trips through `parseAdmissionForm`.
 */
export async function buildImportTemplate(): Promise<Buffer> {
  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>${TEMPLATE_FORM_LINES.map((line) => paragraphXml(line.text, line.bold ?? false)).join('')}
    <w:sectPr/>
  </w:body>
</w:document>`

  const contentTypesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`

  const rootRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`

  const docRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"/>`

  const zip = new JSZip()
  zip.file('[Content_Types].xml', contentTypesXml)
  zip.file('_rels/.rels', rootRelsXml)
  zip.file('word/document.xml', documentXml)
  zip.file('word/_rels/document.xml.rels', docRelsXml)
  return zip.generateAsync({ type: 'nodebuffer' })
}

