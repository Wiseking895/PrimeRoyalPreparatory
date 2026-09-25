import { inflateSync } from 'node:zlib'
import { PDFDocument } from 'pdf-lib'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { PupilView } from './pupil-mapper'
import { admissionFormFilename, renderAdmissionFormPdf, resolveAcademicYear } from './admission-form-pdf.service'

const prismaMock = vi.hoisted(() => ({
  academicSession: { findFirst: vi.fn() },
}))

vi.mock('../lib/prisma', () => ({ prisma: prismaMock }))

function extractContentStreams(pdf: Buffer): string[] {
  const latin = pdf.toString('latin1')
  const streams: string[] = []
  let cursor = 0
  for (;;) {
    const index = latin.indexOf('stream', cursor)
    if (index === -1) break
    if (index >= 3 && latin.slice(index - 3, index) === 'end') {
      cursor = index + 6
      continue
    }
    let start = index + 'stream'.length
    if (latin[start] === '\r') start += 1
    if (latin[start] === '\n') start += 1
    const end = latin.indexOf('endstream', start)
    if (end === -1) break
    const raw = Buffer.from(latin.slice(start, end), 'latin1')
    try {
      streams.push(inflateSync(raw).toString('latin1'))
    } catch {
      streams.push(raw.toString('latin1'))
    }
    cursor = end + 'endstream'.length
  }
  return streams
}

function extractPdfText(pdf: Buffer): string {
  return extractContentStreams(pdf)
    .map((content) => {
      const chunks: string[] = []
      const patterns = [/<([0-9A-Fa-f]+)>\s*Tj/g, /\(([^)]*)\)\s*Tj/g]
      for (const pattern of patterns) {
        let match: RegExpExecArray | null
        while ((match = pattern.exec(content)) !== null) {
          const token = match[1]
          chunks.push(pattern.source.startsWith('<') ? Buffer.from(token, 'hex').toString('latin1') : token)
        }
      }
      return chunks.join('\n')
    })
    .join('\n')
}

function normalize(text: string): string {
  return text.replace(/\s+/g, ' ')
}

function expectAsciiOnly(text: string): void {
  for (const line of text.split('\n')) {
    expect(line).not.toMatch(/[^\x20-\x7E]/)
  }
}

function countTicks(pdf: Buffer): number {
  const content = extractContentStreams(pdf).join('\n')
  return content.match(/[-\d.]+ [-\d.]+ m\s+[-\d.]+ [-\d.]+ l\s+[-\d.]+ [-\d.]+ l\s+S/g)?.length ?? 0
}

function pupilFixture(overrides: Partial<PupilView> = {}): PupilView {
  return {
    id: 'clpupil0000000000000001',
    pupilId: 'PRPS-PUP-0001',
    admissionNumber: 'ADM-2026-001',
    sheetNumber: '28',
    admissionFee: '700.00',
    firstName: 'Kwame',
    middleName: 'Nkrumah',
    lastName: 'Mensah',
    fullName: 'Kwame Nkrumah Mensah',
    dateOfBirth: '2019-05-14T00:00:00.000Z',
    gender: 'MALE',
    profilePictureUrl: null,
    nationality: 'Ghanaian',
    religion: 'Christian',
    admissionReason: 'Close to home and strong academic record',
    previousSchool: 'Sunrise International School',
    stayWithChild: 'Father',
    declarationAcknowledged: true,
    classId: 'class-1',
    className: 'Class 1',
    dateAdmitted: '2026-09-01T00:00:00.000Z',
    status: 'ACTIVE',
    address: 'House 12, Atimatim Road',
    guardians: [
      {
        id: 'guardian-father',
        fullName: 'Kwabena Mensah',
        phone: '0244111222',
        email: 'kwabena@example.com',
        address: 'House 12, Atimatim Road',
        occupation: 'Engineer',
        relationship: 'Father',
        isPrimary: true,
        isEmergency: true,
      },
      {
        id: 'guardian-mother',
        fullName: 'Ama Mensah',
        phone: '0209887766',
        email: null,
        address: 'House 12, Atimatim Road',
        occupation: 'Trader',
        relationship: 'Mother',
        isPrimary: false,
        isEmergency: false,
      },
    ],
    uniforms: [
      { slot: 1, label: 'Main Uniform', status: 'COLLECTED' },
      { slot: 2, label: 'Outing', status: 'COLLECTED' },
      { slot: 3, label: 'Friday Wear', status: 'NOT_COLLECTED' },
      { slot: 4, label: 'Thursday Wear', status: 'COLLECTED' },
      { slot: 5, label: 'Cream Uniform', status: 'NOT_COLLECTED' },
    ],
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-01T00:00:00.000Z',
    ...overrides,
  }
}

async function render(pupil: PupilView, academicYear = '2026/2027'): Promise<{ pdf: Buffer; text: string }> {
  const pdf = await renderAdmissionFormPdf(pupil, academicYear)
  return { pdf, text: extractPdfText(pdf) }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('renderAdmissionFormPdf', () => {
  it('renders a valid single-page A4 PDF', async () => {
    const { pdf } = await render(pupilFixture())
    expect(pdf.subarray(0, 5).toString('latin1')).toBe('%PDF-')
    const doc = await PDFDocument.load(pdf)
    expect(doc.getPageCount()).toBe(1)
    const page = doc.getPage(0)
    expect(Math.abs(page.getWidth() - 595.28)).toBeLessThan(1)
    expect(Math.abs(page.getHeight() - 841.89)).toBeLessThan(1)
  })

  it('prints the PRPS header block with the academic year', async () => {
    const { text } = await render(pupilFixture())
    expect(text).toContain('PRIME ROYAL PREPARATORY SCHOOL')
    expect(text).toContain('P. O. BOX SE 724, ATIMATIM - KUMASI')
    expect(text).toContain('ADMISSION FORM - PRI - SCHOOL')
    expect(text).toContain('Academic Year: 2026/2027')
  })

  it('prints every child-information field of the saved record', async () => {
    const { text } = await render(pupilFixture())
    const normalized = normalize(text)
    expect(normalized).toContain('NAME OF CHILD: Kwame Nkrumah Mensah')
    expect(normalized).toContain('DATE OF ADMISSION: 01/09/2026')
    expect(normalized).toContain('DATE OF BIRTH: 14/05/2019')
    expect(normalized).toContain('CLASS SEEKING: Class 1')
    expect(normalized).toContain('SCHOOL ATTENDED: Sunrise International School')
    expect(normalized).toContain('REASON FOR JOINING SCHOOL: Close to home and strong academic record')
    expect(normalized).toContain('HOUSE NUMBER: House 12, Atimatim Road')
    expect(normalized).toContain('NATIONALITY: Ghanaian')
    expect(normalized).toContain('RELIGION: Christian')
    expect(normalized).not.toContain('GENDER')
  })

  it('prints father, living arrangement and mother sections from the guardians', async () => {
    const { text } = await render(pupilFixture())
    const normalized = normalize(text)
    expect(normalized).toContain("FATHER'S NAME: Kwabena Mensah")
    expect(normalized).toContain('OCCUPATION: Engineer')
    expect(normalized).toContain('ADDRESS / CONTACT: House 12, Atimatim Road, 0244111222')
    expect(normalized).toContain('STAY WITH THE CHILD: Father')
    expect(normalized).toContain("MOTHER'S NAME: Ama Mensah")
    expect(normalized).toContain('ADDRESS / CONTACT: House 12, Atimatim Road, 0209887766')
    expect(normalized).toContain('OCCUPATION: Trader')
  })

  it('prints the guardian declaration with the guardian name and acknowledgement', async () => {
    const { text } = await render(pupilFixture())
    const normalized = normalize(text)
    expect(normalized).toContain(
      "I, Kwabena Mensah, the undersigned, have read through the school's information carefully.",
    )
    expect(normalized).toContain("I hope my ward abides by all regulations of the school. I also wish to pay my ward's fees as stated.")
    expect(normalized).toContain('Declaration acknowledged: Yes')
    expect(normalized).toContain("Guardian's signature:")
    expect(normalized).toContain('Date:')
  })

  it('prints admission number, payment and sheet number in office use', async () => {
    const { text } = await render(pupilFixture())
    const normalized = normalize(text)
    expect(normalized).toContain('OFFICE USE')
    expect(normalized).toContain('ADMISSION NO.: ADM-2026-001')
    expect(normalized).toContain('PAYMENT: GHS 700.00')
    expect(normalized).toContain('SHEET NO.: 28')
  })

  it('prints the five canonical uniform names under the tick heading', async () => {
    const { text } = await render(pupilFixture())
    expect(text).toContain('UNIFORMS SUPPLIED (TICK WHERE APPROPRIATE)')
    expect(text).toContain('Main Uniform')
    expect(text).toContain('Outing')
    expect(text).toContain('Friday Wear')
    expect(text).toContain('Thursday Wear')
    expect(text).toContain('Cream Uniform')
  })

  it('draws exactly one tick per collected uniform', async () => {
    const { pdf } = await render(pupilFixture())
    expect(countTicks(pdf)).toBe(3)
  })

  it('draws no ticks when no uniforms were collected', async () => {
    const uniforms = pupilFixture().uniforms.map((uniform) => ({ ...uniform, status: 'NOT_COLLECTED' as const }))
    const { pdf } = await render(pupilFixture({ uniforms }))
    expect(countTicks(pdf)).toBe(0)
  })

  it('draws five ticks when every uniform was collected', async () => {
    const uniforms = pupilFixture().uniforms.map((uniform) => ({ ...uniform, status: 'COLLECTED' as const }))
    const { pdf } = await render(pupilFixture({ uniforms }))
    expect(countTicks(pdf)).toBe(5)
  })

  it('wraps long child and guardian values without losing characters', async () => {
    const longName = 'Kwame Nkrumah Mensah Ofosu Amoako Duah Yeboah Sekyere Ababio Nti'
    const longOccupation = 'Senior Manufacturing Operations And Quality Assurance Coordinator'
    const longAddress = 'House Number Twelve Atimatim Road Near The Central Market Zone One Kumasi'
    const longReason = 'Transferred from another region and seeking a school closer to the family home'
    const { pdf, text } = await render(
      pupilFixture({
        fullName: longName,
        guardians: [
          pupilFixture().guardians[0],
          { ...pupilFixture().guardians[1], occupation: longOccupation, address: longAddress },
        ],
        admissionReason: longReason,
      }),
    )
    await PDFDocument.load(pdf)
    const normalized = normalize(text)
    expect(normalized).toContain(`NAME OF CHILD: ${longName}`)
    expect(normalized).toContain(`REASON FOR JOINING SCHOOL: ${longReason}`)
    expect(normalized).toContain(`MOTHER'S NAME: Ama Mensah`)
    expect(normalized).toContain(longOccupation)
    expect(normalized).toContain(longAddress)
  })

  it('wraps a long guardian name inside the declaration sentence', async () => {
    const longGuardianName = 'Kwabena Nkrumah Mensah Osei Kwarteng Owusu Ansah Duah Amankwah Boateng'
    const { pdf, text } = await render(
      pupilFixture({
        guardians: [
          { ...pupilFixture().guardians[0], fullName: longGuardianName },
          pupilFixture().guardians[1],
        ],
      }),
    )
    await PDFDocument.load(pdf)
    const normalized = normalize(text)
    expect(normalized).toContain(`I, ${longGuardianName}, the undersigned,`)
  })

  it('renders a sparse record with blanks instead of placeholders', async () => {
    const sparse = pupilFixture({
      admissionNumber: null,
      sheetNumber: null,
      admissionFee: null,
      nationality: null,
      religion: null,
      admissionReason: null,
      previousSchool: null,
      stayWithChild: null,
      address: null,
      guardians: [],
      declarationAcknowledged: false,
      uniforms: [],
    })
    const { text } = await render(sparse)
    const normalized = normalize(text)
    expect(text).toContain('OFFICE USE')
    expect(normalized).not.toContain('GHS')
    expect(normalized).not.toContain('[value]')
    expect(normalized).toContain('Declaration acknowledged: No')
    expect(normalized).toContain('[Guardian Name]')
    expectAsciiOnly(text)
  })

  it('strips characters the PDF font cannot encode', async () => {
    const { pdf, text } = await render(
      pupilFixture({
        admissionReason: 'Needs \u20A150 scholarship \u2014 contact \u201Coffice\u201D today',
        previousSchool: 'St. Peter\u2019s Basic School',
      }),
    )
    await PDFDocument.load(pdf)
    expectAsciiOnly(text)
    expect(normalize(text)).toContain('Needs 50 scholarship - contact "office" today')
    expect(normalize(text)).toContain("St. Peter's Basic School")
  })

  it('renders a Word-imported admission record with the same sections and ticks', async () => {
    const imported = pupilFixture({
      guardians: [
        {
          id: 'guardian-father',
          fullName: 'Yaw Addo',
          phone: '0551234567',
          email: null,
          address: 'P.O. Box 44, Kumasi',
          occupation: 'Farmer',
          relationship: 'Father',
          isPrimary: true,
          isEmergency: false,
        },
        {
          id: 'guardian-mother',
          fullName: 'Abena Addo',
          phone: null,
          email: null,
          address: 'P.O. Box 44, Kumasi',
          occupation: 'Market Trader',
          relationship: 'Mother',
          isPrimary: false,
          isEmergency: false,
        },
      ],
      uniforms: [
        { slot: 1, label: 'Main Uniform', status: 'COLLECTED' },
        { slot: 2, label: 'Outing', status: 'COLLECTED' },
        { slot: 3, label: 'Friday Wear', status: 'COLLECTED' },
        { slot: 4, label: 'Thursday Wear', status: 'COLLECTED' },
        { slot: 5, label: 'Cream Uniform', status: 'COLLECTED' },
      ],
    })
    const { pdf, text } = await render(imported)
    const normalized = normalize(text)
    await PDFDocument.load(pdf)
    expect(normalized).toContain("FATHER'S NAME: Yaw Addo")
    expect(normalized).toContain("MOTHER'S NAME: Abena Addo")
    expect(normalized).toContain('STAY WITH THE CHILD: Father')
    expect(normalized).toContain('ADMISSION NO.: ADM-2026-001')
    expect(normalized).toContain('PAYMENT: GHS 700.00')
    expect(normalized).toContain('SHEET NO.: 28')
    expect(normalized).toContain('SCHOOL ATTENDED: Sunrise International School')
    expect(normalized).toContain('Declaration acknowledged: Yes')
    expect(countTicks(pdf)).toBe(5)
  })

  it('falls back to the primary guardian for the declaration when no parent is labelled', async () => {
    const { text } = await render(
      pupilFixture({
        guardians: [
          {
            id: 'guardian-1',
            fullName: 'Akosua Frimpong',
            phone: '0244000111',
            email: null,
            address: 'Atimatim',
            occupation: 'Seamstress',
            relationship: null,
            isPrimary: true,
            isEmergency: false,
          },
        ],
      }),
    )
    const normalized = normalize(text)
    expect(normalized).toContain("FATHER'S NAME: Akosua Frimpong")
    expect(normalized).not.toContain("MOTHER'S NAME: Akosua Frimpong")
    expect(normalized).toContain('I, Akosua Frimpong, the undersigned,')
  })
})

describe('admissionFormFilename', () => {
  it('uses the admission number', () => {
    expect(admissionFormFilename(pupilFixture())).toBe('PRPS-Admission-Form-ADM-2026-001.pdf')
  })

  it('falls back to the public pupil id when no admission number exists', () => {
    expect(admissionFormFilename(pupilFixture({ admissionNumber: null }))).toBe(
      'PRPS-Admission-Form-PRPS-PUP-0001.pdf',
    )
  })

  it('sanitises unsafe characters from the admission number', () => {
    expect(admissionFormFilename(pupilFixture({ admissionNumber: 'ADM 2026/001' }))).toBe(
      'PRPS-Admission-Form-ADM-2026-001.pdf',
    )
  })
})

describe('resolveAcademicYear', () => {
  it('returns the active academic session name', async () => {
    prismaMock.academicSession.findFirst.mockResolvedValue({ name: '2025/2026' })
    await expect(resolveAcademicYear()).resolves.toBe('2025/2026')
    expect(prismaMock.academicSession.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { status: 'ACTIVE' } }),
    )
  })

  it('falls back to the current school year when no session exists', async () => {
    prismaMock.academicSession.findFirst.mockResolvedValue(undefined)
    const year = await resolveAcademicYear()
    expect(year).toMatch(/^\d{4}\/\d{4}$/)
  })
})
