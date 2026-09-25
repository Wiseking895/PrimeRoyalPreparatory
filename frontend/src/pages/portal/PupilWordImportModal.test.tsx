import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PupilWordImportModal } from './PupilWordImportModal'
import type {
  PupilImportConfirmResult,
  PupilImportPreview,
  PupilImportPreviewRow,
  SchoolClassView,
} from '@/types/portal'

const apiMock = vi.hoisted(() => ({
  previewPupilImport: vi.fn(),
  confirmPupilImport: vi.fn(),
  downloadImportTemplate: vi.fn(),
  createPupil: vi.fn(),
}))

vi.mock('@/lib/api', () => ({ api: apiMock }))

const pushMock = vi.hoisted(() => vi.fn())

vi.mock('@/components/dashboard/Toast', () => ({
  useToast: () => ({ push: pushMock }),
}))

function classFixture(overrides: Partial<SchoolClassView> = {}): SchoolClassView {
  return {
    id: 'class-basic-3',
    key: 'BASIC_3',
    name: 'Basic 3',
    description: null,
    sortOrder: 0,
    status: 'ACTIVE',
    pupilCount: 10,
    activePupilCount: 10,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

function blankUniformsFixture(): PupilImportPreviewRow['data']['uniforms'] {
  return [1, 2, 3, 4, 5].map((slot) => ({ slot, label: null, status: 'NOT_COLLECTED' }))
}

function previewFixture(): PupilImportPreview {
  return {
    totalRows: 3,
    validCount: 1,
    warningCount: 1,
    duplicateCount: 1,
    errorCount: 0,
    rows: [
      {
        rowNumber: 1,
        status: 'VALID',
        messages: [],
        correctableClass: false,
        correctable: false,
        fullName: 'John Mensah',
        data: {
          firstName: 'John',
          middleName: null,
          lastName: 'Mensah',
          dateOfBirth: '2015-03-12',
          gender: 'MALE',
          classId: 'class-basic-3',
          classLabel: 'Basic 3',
          address: null,
          nationality: 'Ghanaian',
          religion: null,
          admissionReason: null,
          admissionNumber: 'ADM-2026-001',
          sheetNumber: '12',
          admissionFee: '250.00',
          uniforms: [
            { slot: 1, label: 'Item 1', status: 'COLLECTED' },
            { slot: 2, label: null, status: 'NOT_COLLECTED' },
            { slot: 3, label: null, status: 'NOT_COLLECTED' },
            { slot: 4, label: null, status: 'NOT_COLLECTED' },
            { slot: 5, label: null, status: 'NOT_COLLECTED' },
          ],
          guardian: null,
        },
        duplicateOf: null,
      },
      {
        rowNumber: 2,
        status: 'WARNING',
        messages: ['A pupil with a similar name already exists.'],
        correctableClass: false,
        correctable: false,
        fullName: 'Ama Owusu',
        data: {
          firstName: 'Ama',
          middleName: null,
          lastName: 'Owusu',
          dateOfBirth: '2014-06-01',
          gender: 'FEMALE',
          classId: 'class-basic-3',
          classLabel: 'Basic 3',
          address: null,
          nationality: null,
          religion: null,
          admissionReason: null,
          admissionNumber: null,
          sheetNumber: null,
          admissionFee: null,
          uniforms: blankUniformsFixture(),
          guardian: null,
        },
        duplicateOf: null,
      },
      {
        rowNumber: 3,
        status: 'DUPLICATE',
        messages: ['Already registered as PRPS-PUP-0001.'],
        correctableClass: false,
        correctable: false,
        fullName: 'Kofi Asante',
        data: {
          firstName: 'Kofi',
          middleName: null,
          lastName: 'Asante',
          dateOfBirth: '2015-01-01',
          gender: 'MALE',
          classId: 'class-basic-3',
          classLabel: 'Basic 3',
          address: null,
          nationality: null,
          religion: null,
          admissionReason: null,
          admissionNumber: null,
          sheetNumber: null,
          admissionFee: null,
          uniforms: blankUniformsFixture(),
          guardian: null,
        },
        duplicateOf: { pupilId: 'PRPS-PUP-0001', fullName: 'Kofi Asante' },
      },
    ],
  }
}

function confirmResultFixture(): PupilImportConfirmResult {
  return {
    total: 2,
    created: 2,
    skipped: 0,
    failed: 0,
    results: [
      { rowNumber: 1, fullName: 'John Mensah', status: 'CREATED', pupilId: 'PRPS-PUP-0101' },
      { rowNumber: 2, fullName: 'Ama Owusu', status: 'CREATED', pupilId: 'PRPS-PUP-0102' },
    ],
  }
}

/** One filled PRPS admission form: missing gender (correctable), both parents. */
function formPreviewFixture(): PupilImportPreview {
  return {
    sourceFormat: 'FORM',
    totalRows: 1,
    validCount: 0,
    warningCount: 0,
    duplicateCount: 0,
    errorCount: 1,
    rows: [
      {
        rowNumber: 1,
        status: 'ERROR',
        messages: ['Gender is required.'],
        warnings: ['Uniform 3 tick mark was not readable.'],
        correctableClass: false,
        correctable: true,
        fullName: 'Kofi Boateng',
        data: {
          firstName: 'Kofi',
          middleName: null,
          lastName: 'Boateng',
          dateOfBirth: '2024-10-28',
          gender: null,
          classId: 'class-basic-3',
          classLabel: 'Basic 3',
          dateAdmitted: '2026-09-22',
          address: 'HN 12',
          previousSchool: 'Sunrise Academy',
          stayWithChild: 'Father',
          nationality: 'Ghanaian',
          religion: 'Christianity',
          admissionReason: 'Close to home',
          declarationAcknowledged: true,
          admissionNumber: 'ADM-2026-001',
          sheetNumber: '28',
          admissionFee: '700.00',
          uniforms: [
            { slot: 1, label: 'Main Uniform', status: 'COLLECTED' },
            { slot: 2, label: 'Outing', status: 'NOT_COLLECTED' },
            { slot: 3, label: 'Friday Wear', status: 'NOT_COLLECTED' },
            { slot: 4, label: 'Thursday Wear', status: 'NOT_COLLECTED' },
            { slot: 5, label: 'Cream Uniform', status: 'NOT_COLLECTED' },
          ],
          guardians: [
            {
              fullName: 'Yaw Boateng',
              phone: '0244111222',
              address: 'HN 12',
              occupation: 'Farmer',
              relationship: 'Father',
              isPrimary: true,
              isEmergency: true,
            },
            {
              fullName: 'Adwoa Boateng',
              phone: '0244333444',
              address: 'HN 12',
              occupation: 'Trader',
              relationship: 'Mother',
              isPrimary: false,
              isEmergency: true,
            },
          ],
          guardian: {
            fullName: 'Yaw Boateng',
            phone: '0244111222',
            address: 'HN 12',
            occupation: 'Farmer',
            relationship: 'Father',
          },
        },
        duplicateOf: null,
      },
    ],
  }
}

function renderModal(overrides: Partial<Parameters<typeof PupilWordImportModal>[0]> = {}) {
  const onImported = vi.fn().mockResolvedValue(undefined)
  const onClose = vi.fn()
  render(
    <PupilWordImportModal
      open
      onClose={onClose}
      onImported={onImported}
      classes={[classFixture()]}
      {...overrides}
    />,
  )
  return { onImported, onClose }
}

function selectDocxFile() {
  const file = new File(['docx-bytes'], 'pupils.docx', {
    type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  })
  const input = screen.getByLabelText('Choose Word document') as HTMLInputElement
  Object.defineProperty(input, 'files', { value: [file] })
  fireEvent.change(input)
  return file
}

describe('PupilWordImportModal', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    pushMock.mockReset()
    apiMock.previewPupilImport.mockResolvedValue(previewFixture())
    apiMock.confirmPupilImport.mockResolvedValue(confirmResultFixture())
    apiMock.downloadImportTemplate.mockResolvedValue(undefined)
    apiMock.createPupil.mockClear()
  })

  it('shows help text and a template download on the upload step', async () => {
    renderModal()

    expect(
      screen.getByText(
        "Use a completed copy of the school's admission form, or a Word table with one pupil per row and the provided column headings.",
      ),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Download template/i })).toBeInTheDocument()
    expect(apiMock.createPupil).not.toHaveBeenCalled()
  })

  it('downloads the import template without writing to the database', async () => {
    renderModal()

    fireEvent.click(screen.getByRole('button', { name: /Download template/i }))

    await waitFor(() => {
      expect(apiMock.downloadImportTemplate).toHaveBeenCalledTimes(1)
    })
    expect(apiMock.createPupil).not.toHaveBeenCalled()
    expect(apiMock.previewPupilImport).not.toHaveBeenCalled()
  })

  it('rejects non-docx filenames before calling the preview API', async () => {
    renderModal()

    const file = new File(['legacy'], 'pupils.doc', { type: 'application/msword' })
    const input = screen.getByLabelText('Choose Word document') as HTMLInputElement
    Object.defineProperty(input, 'files', { value: [file] })
    fireEvent.change(input)

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/\.docx/i)
    })
    expect(apiMock.previewPupilImport).not.toHaveBeenCalled()
  })

  it('previews a document without registering pupils', async () => {
    renderModal()

    selectDocxFile()

    expect(await screen.findByText('John Mensah')).toBeInTheDocument()
    expect(screen.getByText('Warning')).toBeInTheDocument()
    expect(screen.getByText('Duplicate')).toBeInTheDocument()
    expect(apiMock.previewPupilImport).toHaveBeenCalledTimes(1)
    expect(apiMock.confirmPupilImport).not.toHaveBeenCalled()
    expect(apiMock.createPupil).not.toHaveBeenCalled()
  })

  it('defaults VALID and WARNING rows to selected, DUPLICATE to unselected', async () => {
    renderModal()

    selectDocxFile()
    await screen.findByText('John Mensah')

    expect(screen.getByLabelText('Include row 1')).toBeChecked()
    expect(screen.getByLabelText('Include row 2')).toBeChecked()
    expect(screen.getByLabelText('Include row 3')).not.toBeChecked()
    expect(screen.getByRole('button', { name: /Confirm & Register Pupils \(2\)/ })).toBeEnabled()
  })

  it('lets the Headteacher fix a class-not-found row in the preview before confirming', async () => {
    const preview = previewFixture()
    preview.rows[2] = {
      ...preview.rows[2],
      status: 'ERROR',
      messages: ['Class not found'],
      correctableClass: true,
      duplicateOf: null,
      data: { ...preview.rows[2].data, classId: null, classLabel: 'Basic 7' },
    }
    preview.duplicateCount = 0
    preview.errorCount = 1
    apiMock.previewPupilImport.mockResolvedValue(preview)

    renderModal()
    selectDocxFile()
    await screen.findByText('Kofi Asante')

    const checkbox = screen.getByLabelText('Include row 3')
    expect(checkbox).toBeDisabled()

    fireEvent.change(screen.getByLabelText('Class for row 3'), {
      target: { value: 'class-basic-3' },
    })

    expect(checkbox).toBeEnabled()

    fireEvent.click(checkbox)
    expect(screen.getByRole('button', { name: /Confirm & Register Pupils \(3\)/ })).toBeEnabled()
  })

  it('confirms only the included rows and reports the result', async () => {
    const { onImported } = renderModal()

    selectDocxFile()
    await screen.findByText('John Mensah')

    fireEvent.click(screen.getByRole('button', { name: /Confirm & Register Pupils \(2\)/ }))

    await waitFor(() => {
      expect(apiMock.confirmPupilImport).toHaveBeenCalledTimes(1)
    })

    expect(apiMock.confirmPupilImport).toHaveBeenCalledWith({
      pupils: [
        expect.objectContaining({
          rowNumber: 1,
          firstName: 'John',
          lastName: 'Mensah',
          gender: 'MALE',
          classId: 'class-basic-3',
          dateOfBirth: '2015-03-12',
        }),
        expect.objectContaining({
          rowNumber: 2,
          firstName: 'Ama',
          lastName: 'Owusu',
          gender: 'FEMALE',
          classId: 'class-basic-3',
        }),
      ],
    })
    expect(apiMock.createPupil).not.toHaveBeenCalled()

    expect(await screen.findByText('Import results')).toBeInTheDocument()
    expect(screen.getByText('Registered')).toBeInTheDocument()
    expect(screen.getByText('PRPS-PUP-0101')).toBeInTheDocument()

    await waitFor(() => {
      expect(onImported).toHaveBeenCalledTimes(1)
    })
    expect(pushMock).toHaveBeenCalledWith('success', expect.stringContaining('registered'))
  })

  it('displays imported admission details and the five uniform items in the preview', async () => {
    renderModal()

    selectDocxFile()
    await screen.findByText('John Mensah')

    expect(screen.getByLabelText('Admission number for row 1')).toHaveValue('ADM-2026-001')
    expect(screen.getByLabelText('Sheet number for row 1')).toHaveValue('12')
    expect(screen.getByLabelText('Admission fee for row 1')).toHaveValue('250.00')
    expect(screen.getByLabelText('Uniform 1 description for row 1')).toHaveValue('Item 1')
    expect(screen.getByLabelText('Uniform 1 status for row 1')).toHaveValue('COLLECTED')
    expect(screen.getByLabelText('Uniform 5 description for row 1')).toHaveValue('')
    expect(screen.getByLabelText('Uniform 5 status for row 1')).toHaveValue('NOT_COLLECTED')
    expect(apiMock.confirmPupilImport).not.toHaveBeenCalled()
  })

  it('passes admission details and uniform items through to confirmation', async () => {
    renderModal()

    selectDocxFile()
    await screen.findByText('John Mensah')

    fireEvent.click(screen.getByRole('button', { name: /Confirm & Register Pupils \(2\)/ }))

    await waitFor(() => {
      expect(apiMock.confirmPupilImport).toHaveBeenCalledTimes(1)
    })

    expect(apiMock.confirmPupilImport).toHaveBeenCalledWith({
      pupils: [
        expect.objectContaining({
          rowNumber: 1,
          admissionNumber: 'ADM-2026-001',
          sheetNumber: '12',
          admissionFee: '250.00',
          uniforms: [
            { slot: 1, label: 'Item 1', status: 'COLLECTED' },
            { slot: 2, label: null, status: 'NOT_COLLECTED' },
            { slot: 3, label: null, status: 'NOT_COLLECTED' },
            { slot: 4, label: null, status: 'NOT_COLLECTED' },
            { slot: 5, label: null, status: 'NOT_COLLECTED' },
          ],
        }),
        expect.objectContaining({
          rowNumber: 2,
          admissionNumber: undefined,
          sheetNumber: undefined,
          admissionFee: undefined,
        }),
      ],
    })
  })

  it('lets the Headteacher fix an admission-number error row in the preview', async () => {
    const preview = previewFixture()
    preview.rows[2] = {
      ...preview.rows[2],
      status: 'ERROR',
      messages: ['Admission number is too long.'],
      correctableClass: false,
      correctable: true,
      duplicateOf: null,
      data: { ...preview.rows[2].data, admissionNumber: 'X'.repeat(41) },
    }
    preview.duplicateCount = 0
    preview.errorCount = 1
    apiMock.previewPupilImport.mockResolvedValue(preview)

    renderModal()
    selectDocxFile()
    await screen.findByText('Kofi Asante')

    const checkbox = screen.getByLabelText('Include row 3')
    expect(checkbox).toBeDisabled()

    fireEvent.change(screen.getByLabelText('Admission number for row 3'), {
      target: { value: 'ADM-0042' },
    })

    expect(checkbox).toBeEnabled()
    fireEvent.click(checkbox)
    expect(screen.getByRole('button', { name: /Confirm & Register Pupils \(3\)/ })).toBeEnabled()
  })

  it('surfaces a preview API failure as an error without confirm', async () => {
    apiMock.previewPupilImport.mockRejectedValue(new Error('Missing required column headings.'))
    renderModal()

    selectDocxFile()

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Missing required column headings.')
    })
    expect(apiMock.confirmPupilImport).not.toHaveBeenCalled()
    expect(apiMock.createPupil).not.toHaveBeenCalled()
  })

  it('surfaces row warnings alongside messages', async () => {
    const preview = previewFixture()
    preview.rows[1] = { ...preview.rows[1], warnings: ['Uniform 3 tick mark was not readable.'] }
    apiMock.previewPupilImport.mockResolvedValue(preview)

    renderModal()
    selectDocxFile()
    await screen.findByText('Ama Owusu')

    expect(screen.getByText('Uniform 3 tick mark was not readable.')).toBeInTheDocument()
  })

  it('does not render when closed', () => {
    render(
      <PupilWordImportModal
        open={false}
        onClose={vi.fn()}
        onImported={vi.fn()}
        classes={[classFixture()]}
      />,
    )
    expect(screen.queryByText('Import pupils from Word')).not.toBeInTheDocument()
  })

  it('renders the admission form preview as grouped cards', async () => {
    apiMock.previewPupilImport.mockResolvedValue(formPreviewFixture())
    renderModal()

    selectDocxFile()
    await screen.findByText('Kofi Boateng')

    expect(
      screen.getByText('Source: PRPS admission form document (one pupil per form)'),
    ).toBeInTheDocument()
    expect(screen.getByText('Child information')).toBeInTheDocument()
    expect(screen.getByText('Parents & guardians')).toBeInTheDocument()
    expect(screen.getByText('Office use')).toBeInTheDocument()
    expect(screen.getByText('Uniforms supplied')).toBeInTheDocument()
    expect(screen.getByText('Yaw Boateng')).toBeInTheDocument()
    expect(screen.getByText('Adwoa Boateng')).toBeInTheDocument()
    expect(screen.getByText('Sunrise Academy')).toBeInTheDocument()
    expect(screen.getByText('Gender is required.')).toBeInTheDocument()
    expect(screen.getByText('Uniform 3 tick mark was not readable.')).toBeInTheDocument()
    expect(apiMock.confirmPupilImport).not.toHaveBeenCalled()
  })

  it('lets the Headteacher set the gender missing from the form and confirms the full form data', async () => {
    apiMock.previewPupilImport.mockResolvedValue(formPreviewFixture())
    const { onImported } = renderModal()

    selectDocxFile()
    await screen.findByText('Kofi Boateng')

    const checkbox = screen.getByLabelText('Include row 1')
    expect(checkbox).toBeDisabled()

    fireEvent.change(screen.getByLabelText('Gender for row 1'), { target: { value: 'MALE' } })

    expect(checkbox).toBeEnabled()
    expect(screen.getByText('Gender corrected to Male.')).toBeInTheDocument()
    fireEvent.click(checkbox)
    expect(screen.getByRole('button', { name: /Confirm & Register Pupils \(1\)/ })).toBeEnabled()

    fireEvent.click(screen.getByRole('button', { name: /Confirm & Register Pupils \(1\)/ }))

    await waitFor(() => {
      expect(apiMock.confirmPupilImport).toHaveBeenCalledTimes(1)
    })

    expect(apiMock.confirmPupilImport).toHaveBeenCalledWith({
      pupils: [
        expect.objectContaining({
          rowNumber: 1,
          firstName: 'Kofi',
          lastName: 'Boateng',
          gender: 'MALE',
          classId: 'class-basic-3',
          dateOfBirth: '2024-10-28',
          dateAdmitted: '2026-09-22',
          address: 'HN 12',
          previousSchool: 'Sunrise Academy',
          stayWithChild: 'Father',
          declarationAcknowledged: true,
          admissionNumber: 'ADM-2026-001',
          sheetNumber: '28',
          admissionFee: '700.00',
          guardians: [
            expect.objectContaining({
              fullName: 'Yaw Boateng',
              relationship: 'Father',
              phone: '0244111222',
              occupation: 'Farmer',
              isPrimary: true,
            }),
            expect.objectContaining({
              fullName: 'Adwoa Boateng',
              relationship: 'Mother',
              phone: '0244333444',
              isPrimary: false,
              isEmergency: true,
            }),
          ],
          uniforms: [
            { slot: 1, label: 'Main Uniform', status: 'COLLECTED' },
            { slot: 2, label: 'Outing', status: 'NOT_COLLECTED' },
            { slot: 3, label: 'Friday Wear', status: 'NOT_COLLECTED' },
            { slot: 4, label: 'Thursday Wear', status: 'NOT_COLLECTED' },
            { slot: 5, label: 'Cream Uniform', status: 'NOT_COLLECTED' },
          ],
        }),
      ],
    })

    expect(await screen.findByText('Import results')).toBeInTheDocument()
    await waitFor(() => {
      expect(onImported).toHaveBeenCalledTimes(1)
    })
  })
})
