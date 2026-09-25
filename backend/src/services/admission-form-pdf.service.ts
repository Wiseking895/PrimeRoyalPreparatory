import { PDFDocument, StandardFonts, drawCheckMark, rgb } from 'pdf-lib'
import type { PDFFont, PDFPage } from 'pdf-lib'
import { prisma } from '../lib/prisma'
import type { GuardianView, PupilView } from './pupil-mapper'
import { ADMISSION_UNIFORM_ITEMS } from './pupil.service'

const PAGE_WIDTH = 595.28
const PAGE_HEIGHT = 841.89
const MARGIN = 45
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2
const LABEL_WIDTH = 150
const VALUE_X = MARGIN + LABEL_WIDTH
const VALUE_WIDTH = CONTENT_WIDTH - LABEL_WIDTH
const BODY_SIZE = 9
const LABEL_SIZE = 8.5
const LEADING = 11
const ROW_GAP = 7
const BOTTOM_MARGIN = 45

const SCHOOL_NAME = 'PRIME ROYAL PREPARATORY SCHOOL'
const SCHOOL_CONTACT = 'P. O. BOX SE 724, ATIMATIM - KUMASI'
const FORM_TITLE = 'ADMISSION FORM - PRI - SCHOOL'
const GUARDIAN_NAME_FALLBACK = '[Guardian Name]'

/**
 * WinAnsi (pdf-lib's PDF string encoding) cannot represent characters such as
 * the cedi sign or curly quotes, so every string drawn on the form is reduced
 * to printable ASCII before it reaches a font.
 */
function toAscii(value: string): string {
  return value
    .replace(/[\u2018\u2019\u02BC]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014\u2212]/g, '-')
    .replace(/\u2026/g, '...')
    .replace(/\u00A0/g, ' ')
    .replace(/[\u2022\u25CF\u25CB]/g, '')
    .replace(/[\u2610\u2611\u2713\u2714]/g, '')
    .replace(/\s+/g, ' ')
    .replace(/[^\x20-\x7E]/g, '')
}

function formatFormDate(isoDate: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(isoDate)
  if (!match) return toAscii(isoDate)
  return `${match[3]}/${match[2]}/${match[1]}`
}

function contactOf(guardian?: GuardianView): string {
  if (!guardian) return ''
  return [guardian.address, guardian.phone]
    .map((part) => (part ?? '').trim())
    .filter(Boolean)
    .join(', ')
}

interface GuardianPair {
  father?: GuardianView
  mother?: GuardianView
}

function splitGuardians(guardians: GuardianView[]): GuardianPair {
  const candidates = guardians.filter((guardian) => guardian.fullName.trim().length > 0)
  let father = candidates.find((guardian) => /father|dad/i.test(guardian.relationship ?? ''))
  const mother = candidates.find((guardian) => /mother|mum|mom/i.test(guardian.relationship ?? ''))
  if (!father) {
    const others = candidates.filter((guardian) => guardian !== mother)
    father = others.find((guardian) => guardian.isPrimary) ?? others[0]
  }
  if (father === mother) return { father }
  return { father, mother }
}

function declarationName(pupil: PupilView): string {
  const { father, mother } = splitGuardians(pupil.guardians)
  const chosen = father ?? mother ?? pupil.guardians.find((guardian) => guardian.fullName.trim())
  return chosen ? chosen.fullName.trim() : GUARDIAN_NAME_FALLBACK
}

function wrapText(text: string, font: PDFFont, size: number, width: number): string[] {
  if (!text) return ['']
  const lines: string[] = []
  let current = ''
  const push = () => {
    if (current) {
      lines.push(current)
      current = ''
    }
  }
  for (const word of text.split(' ')) {
    const candidate = current ? `${current} ${word}` : word
    if (font.widthOfTextAtSize(candidate, size) <= width) {
      current = candidate
      continue
    }
    push()
    if (font.widthOfTextAtSize(word, size) <= width) {
      current = word
      continue
    }
    let chunk = ''
    for (const char of word) {
      const next = chunk + char
      if (chunk && font.widthOfTextAtSize(next, size) > width) {
        lines.push(chunk)
        chunk = char
      } else {
        chunk = next
      }
    }
    current = chunk
  }
  push()
  return lines.length > 0 ? lines : ['']
}

class AdmissionFormBuilder {
  private readonly doc: PDFDocument
  private readonly regular: PDFFont
  private readonly bold: PDFFont
  private page: PDFPage
  private y: number

  constructor(doc: PDFDocument, regular: PDFFont, bold: PDFFont) {
    this.doc = doc
    this.regular = regular
    this.bold = bold
    this.page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT])
    this.y = PAGE_HEIGHT - MARGIN
  }

  private newPage(): void {
    this.page = this.doc.addPage([PAGE_WIDTH, PAGE_HEIGHT])
    this.y = PAGE_HEIGHT - MARGIN
  }

  private ensureSpace(height: number): void {
    if (this.y - height < BOTTOM_MARGIN) this.newPage()
  }

  private measure(text: string, font: PDFFont, size: number, width: number): string[] {
    return wrapText(text, font, size, width)
  }

  private centered(text: string, font: PDFFont, size: number, gap: number): void {
    this.ensureSpace(size + gap)
    const width = font.widthOfTextAtSize(text, size)
    this.page.drawText(text, { x: Math.max(MARGIN, (PAGE_WIDTH - width) / 2), y: this.y - size, font, size })
    this.y -= size + gap
  }

  header(academicYear: string): void {
    this.centered(SCHOOL_NAME, this.bold, 14, 5)
    this.centered(SCHOOL_CONTACT, this.regular, 9.5, 5)
    this.centered(FORM_TITLE, this.bold, 11.5, 4)
    this.centered(`Academic Year: ${toAscii(academicYear)}`, this.regular, 9.5, 7)
    this.page.drawLine({
      start: { x: MARGIN, y: this.y },
      end: { x: MARGIN + CONTENT_WIDTH, y: this.y },
      thickness: 0.8,
    })
    this.y -= 12
  }

  private section(title: string): void {
    this.ensureSpace(70)
    this.page.drawText(toAscii(title), { x: MARGIN, y: this.y - 10, font: this.bold, size: 10 })
    this.y -= 14
    this.page.drawLine({
      start: { x: MARGIN, y: this.y },
      end: { x: MARGIN + CONTENT_WIDTH, y: this.y },
      thickness: 0.7,
    })
    this.y -= 6
  }

  private field(label: string, value: string): void {
    const labelLines = this.measure(`${label}:`, this.bold, LABEL_SIZE, LABEL_WIDTH - 8)
    const valueLines = this.measure(toAscii(value), this.regular, BODY_SIZE, VALUE_WIDTH)
    const lineCount = Math.max(labelLines.length, valueLines.length)
    this.ensureSpace(lineCount * LEADING + ROW_GAP)
    const top = this.y
    let labelCursor = top
    for (const line of labelLines) {
      this.page.drawText(line, { x: MARGIN, y: labelCursor - LABEL_SIZE, font: this.bold, size: LABEL_SIZE })
      labelCursor -= LEADING
    }
    let valueCursor = top
    for (const line of valueLines) {
      if (line) {
        this.page.drawText(line, { x: VALUE_X, y: valueCursor - BODY_SIZE, font: this.regular, size: BODY_SIZE })
      }
      valueCursor -= LEADING
    }
    this.y = Math.max(labelCursor, valueCursor) - ROW_GAP
  }

  private checkbox(checked: boolean, label: string): void {
    this.ensureSpace(18)
    const box = 10
    const boxBottom = this.y - box - 1
    this.page.drawRectangle({
      x: MARGIN,
      y: boxBottom,
      width: box,
      height: box,
      borderColor: rgb(0, 0, 0),
      borderWidth: 1,
    })
    if (checked) {
      this.page.pushOperators(
        ...drawCheckMark({
          x: MARGIN + box / 2,
          y: boxBottom + box / 2,
          size: 4.5,
          thickness: 1.1,
          color: rgb(0, 0, 0),
        }),
      )
    }
    this.page.drawText(toAscii(label), {
      x: MARGIN + box + 8,
      y: boxBottom + 1.5,
      font: this.regular,
      size: BODY_SIZE + 0.5,
    })
    this.y = boxBottom - 5
  }

  childInformation(pupil: PupilView): void {
    this.section('CHILD INFORMATION')
    this.field('NAME OF CHILD', pupil.fullName)
    this.field('DATE OF ADMISSION', formatFormDate(pupil.dateAdmitted))
    this.field('DATE OF BIRTH', formatFormDate(pupil.dateOfBirth))
    this.field('CLASS SEEKING', pupil.className)
    this.field('SCHOOL ATTENDED', pupil.previousSchool ?? '')
    this.field('REASON FOR JOINING SCHOOL', pupil.admissionReason ?? '')
    this.field('HOUSE NUMBER', pupil.address ?? '')
    this.field('NATIONALITY', pupil.nationality ?? '')
    this.field('RELIGION', pupil.religion ?? '')
  }

  fatherSection(pupil: PupilView): void {
    const { father } = splitGuardians(pupil.guardians)
    this.section('FATHER')
    this.field("FATHER'S NAME", father?.fullName ?? '')
    this.field('OCCUPATION', father?.occupation ?? '')
    this.field('ADDRESS / CONTACT', contactOf(father))
  }

  livingArrangement(pupil: PupilView): void {
    this.section('LIVING ARRANGEMENT')
    this.field('STAY WITH THE CHILD', pupil.stayWithChild ?? '')
  }

  motherSection(pupil: PupilView): void {
    const { mother } = splitGuardians(pupil.guardians)
    this.section('MOTHER')
    this.field("MOTHER'S NAME", mother?.fullName ?? '')
    this.field('ADDRESS / CONTACT', contactOf(mother))
    this.field('OCCUPATION', mother?.occupation ?? '')
  }

  declaration(pupil: PupilView): void {
    this.ensureSpace(180)
    this.section("GUARDIAN'S DECLARATION")
    const sentence = `I, ${declarationName(pupil)}, the undersigned, have read through the school's information carefully. I hope my ward abides by all regulations of the school. I also wish to pay my ward's fees as stated.`
    const lines = this.measure(`"${toAscii(sentence)}"`, this.regular, BODY_SIZE, CONTENT_WIDTH - 16)
    for (const line of lines) {
      this.page.drawText(line, { x: MARGIN + 8, y: this.y - BODY_SIZE, font: this.regular, size: BODY_SIZE })
      this.y -= LEADING
    }
    this.y -= 4
    const ackLabel = 'Declaration acknowledged:'
    const ackWidth = this.bold.widthOfTextAtSize(ackLabel, LABEL_SIZE)
    this.page.drawText(ackLabel, { x: MARGIN + 8, y: this.y - LABEL_SIZE, font: this.bold, size: LABEL_SIZE })
    this.page.drawText(pupil.declarationAcknowledged ? 'Yes' : 'No', {
      x: MARGIN + 14 + ackWidth,
      y: this.y - BODY_SIZE,
      font: this.regular,
      size: BODY_SIZE,
    })
    this.y -= LEADING + 4
    const sigLabel = "Guardian's signature:"
    const sigWidth = this.bold.widthOfTextAtSize(sigLabel, LABEL_SIZE)
    const baseline = this.y - LABEL_SIZE
    this.page.drawText(sigLabel, { x: MARGIN + 8, y: baseline, font: this.bold, size: LABEL_SIZE })
    const sigEnd = MARGIN + 8 + sigWidth + 6
    this.page.drawLine({
      start: { x: sigEnd, y: baseline - 2 },
      end: { x: sigEnd + 170, y: baseline - 2 },
      thickness: 0.6,
    })
    const dateLabel = 'Date:'
    const dateX = sigEnd + 188
    const dateWidth = this.bold.widthOfTextAtSize(dateLabel, LABEL_SIZE)
    this.page.drawText(dateLabel, { x: dateX, y: baseline, font: this.bold, size: LABEL_SIZE })
    this.page.drawLine({
      start: { x: dateX + dateWidth + 6, y: baseline - 2 },
      end: { x: MARGIN + CONTENT_WIDTH, y: baseline - 2 },
      thickness: 0.6,
    })
    this.y = baseline - 14
  }

  officeUse(pupil: PupilView): void {
    this.ensureSpace(120)
    const top = this.y
    this.y -= 4
    this.page.drawText('OFFICE USE', { x: MARGIN + 4, y: this.y - 10, font: this.bold, size: 10 })
    this.y -= 14
    this.field('ADMISSION NO.', pupil.admissionNumber ?? '')
    this.field('PAYMENT', pupil.admissionFee ? `GHS ${pupil.admissionFee}` : '')
    this.field('SHEET NO.', pupil.sheetNumber ?? '')
    const boxBottom = this.y + 4
    this.page.drawRectangle({
      x: MARGIN - 4,
      y: boxBottom,
      width: CONTENT_WIDTH + 8,
      height: top - boxBottom,
      borderColor: rgb(0, 0, 0),
      borderWidth: 0.8,
    })
    this.y = boxBottom - 6
  }

  uniforms(pupil: PupilView): void {
    this.section('UNIFORMS SUPPLIED (TICK WHERE APPROPRIATE)')
    for (const item of ADMISSION_UNIFORM_ITEMS) {
      const record = pupil.uniforms.find((uniform) => uniform.slot === item.slot)
      this.checkbox(record?.status === 'COLLECTED', item.name)
    }
  }

  finish(): void {
    const pages = this.doc.getPages()
    for (const [index, page] of pages.entries()) {
      const label = `Page ${index + 1} of ${pages.length}`
      const width = this.regular.widthOfTextAtSize(label, 8)
      page.drawText(label, { x: (PAGE_WIDTH - width) / 2, y: 22, font: this.regular, size: 8 })
    }
  }

  build(academicYear: string, pupil: PupilView): void {
    this.header(academicYear)
    this.childInformation(pupil)
    this.fatherSection(pupil)
    this.livingArrangement(pupil)
    this.motherSection(pupil)
    this.declaration(pupil)
    this.officeUse(pupil)
    this.uniforms(pupil)
    this.finish()
  }
}

/** Renders the saved pupil/admission record as the PRPS admission form PDF. */
export async function renderAdmissionFormPdf(pupil: PupilView, academicYear: string): Promise<Buffer> {
  const doc = await PDFDocument.create()
  const regular = await doc.embedFont(StandardFonts.Helvetica)
  const bold = await doc.embedFont(StandardFonts.HelveticaBold)
  new AdmissionFormBuilder(doc, regular, bold).build(academicYear, pupil)
  return Buffer.from(await doc.save({ useObjectStreams: false }))
}

/** Download filename derived from the public admission number, never the internal id. */
export function admissionFormFilename(pupil: PupilView): string {
  const raw = (pupil.admissionNumber ?? '').trim() || pupil.pupilId || ''
  const safe = raw.replace(/[^A-Za-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '')
  return `PRPS-Admission-Form-${safe || 'Pupil'}.pdf`
}

/** Active academic session shown on the form, with a school-year fallback. */
export async function resolveAcademicYear(): Promise<string> {
  const session = await prisma.academicSession.findFirst({
    where: { status: 'ACTIVE' },
    orderBy: { startDate: 'desc' },
    select: { name: true },
  })
  if (session?.name) return session.name
  const year = new Date().getFullYear()
  return `${year}/${year + 1}`
}
