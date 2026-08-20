import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { SbaEntryPage } from './SbaEntryPage'
import type { AcademicSessionView, AcademicTermView, SbaEntryDataView, TeacherPortalView } from '@/types/portal'

const apiMock = vi.hoisted(() => ({
  academicMe: vi.fn(),
  listSessions: vi.fn(),
  listTerms: vi.fn(),
  sbaEntryData: vi.fn(),
  sbaBulk: vi.fn(),
}))

vi.mock('@/lib/api', () => ({ api: apiMock }))

const pushMock = vi.hoisted(() => vi.fn())

vi.mock('@/components/dashboard/Toast', () => ({
  useToast: () => ({ push: pushMock }),
}))

vi.mock('@/auth/AuthContext', () => ({
  useAuth: () => ({
    user: {
      id: 'teacher-1',
      fullName: 'Kofi Mensah',
      email: 'kofi@school.edu',
      phone: null,
      profilePictureUrl: null,
      status: 'ACTIVE',
      lastLoginAt: null,
      mustChangePassword: false,
      createdAt: '2026-01-01T00:00:00.000Z',
      staffId: 'PRPS-T-0001',
      category: 'ACADEMIC',
      position: 'SUBJECT_TEACHER',
      roles: ['SUBJECT_TEACHER'],
      permissions: ['academic.view', 'sba.view', 'sba.manage'],
    },
    hasPermission: (key: string) => ['academic.view', 'sba.view', 'sba.manage'].includes(key),
  }),
}))

function portalFixture(): TeacherPortalView {
  return {
    teacher: {
      id: 'teacher-1',
      fullName: 'Kofi Mensah',
      email: 'kofi@school.edu',
      phone: null,
      staffId: 'PRPS-T-0001',
      position: 'SUBJECT_TEACHER',
      positionLabel: 'Subject Teacher',
    },
    classesAsClassTeacher: [],
    teachingAssignments: [
      {
        id: 'assignment-1',
        teacherId: 'teacher-1',
        subjectId: 'subject-1',
        subjectCode: 'MATH',
        subjectName: 'Mathematics',
        classId: 'class-1',
        className: 'Primary 1',
        status: 'ACTIVE',
        pupilCount: 1,
        sbaEnteredCount: 0,
        createdAt: '2026-08-01T00:00:00.000Z',
      },
    ],
    sba: { totalEntered: 0, recordsCurrentTerm: 0 },
    recentSba: [],
  }
}

function sessionFixture(overrides: Partial<AcademicSessionView> = {}): AcademicSessionView {
  return {
    id: 'session-1',
    name: '2026/2027 Session',
    startDate: '2026-09-01',
    endDate: '2027-07-31',
    status: 'ACTIVE',
    termCount: 3,
    feeCount: 0,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

function termFixture(overrides: Partial<AcademicTermView> = {}): AcademicTermView {
  return {
    id: 'term-1',
    sessionId: 'session-1',
    name: 'First Term',
    termNumber: 1,
    startDate: '2026-09-01',
    endDate: '2026-12-18',
    schoolDays: 80,
    status: 'ACTIVE',
    ...overrides,
  }
}

function entryFixture(overrides: Partial<SbaEntryDataView> = {}): SbaEntryDataView {
  return {
    subject: { id: 'subject-1', code: 'MATH', name: 'Mathematics' },
    class: { id: 'class-1', name: 'Primary 1' },
    term: { id: 'term-1', name: 'First Term', sessionName: '2026/2027 Session' },
    access: 'manage',
    pupils: [
      {
        id: 'pupil-1',
        pupilId: 'PRPS-P-0001',
        fullName: 'Ama Mensah',
        status: 'ACTIVE',
        record: null,
      },
    ],
    ...overrides,
  }
}

function renderPage() {
  return render(
    <MemoryRouter>
      <SbaEntryPage />
    </MemoryRouter>,
  )
}

describe('SbaEntryPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    pushMock.mockReset()
    apiMock.academicMe.mockResolvedValue(portalFixture())
    apiMock.listSessions.mockResolvedValue([sessionFixture()])
    apiMock.listTerms.mockResolvedValue([termFixture()])
    apiMock.sbaEntryData.mockResolvedValue(entryFixture())
    apiMock.sbaBulk.mockResolvedValue({ updated: 1, created: 0, unchanged: 0 })
  })

  it('renders an empty state when the teacher has no assignments', async () => {
    apiMock.academicMe.mockResolvedValue({ ...portalFixture(), teachingAssignments: [] })
    renderPage()

    expect(await screen.findByText('No teaching assignments yet.')).toBeInTheDocument()
    expect(apiMock.sbaEntryData).not.toHaveBeenCalled()
  })

  it('loads pupils once a class, subject and term are selected', async () => {
    renderPage()

    const combo = await screen.findByLabelText('Class & Subject')
    fireEvent.change(combo, { target: { value: 'subject-1|class-1' } })
    fireEvent.change(screen.getByLabelText('Term'), { target: { value: 'term-1' } })

    expect(await screen.findByText('Ama Mensah')).toBeInTheDocument()
    expect(apiMock.sbaEntryData).toHaveBeenCalledWith({ classId: 'class-1', subjectId: 'subject-1', termId: 'term-1' })
  })

  it('keeps input focus while typing a score', async () => {
    renderPage()

    const combo = await screen.findByLabelText('Class & Subject')
    fireEvent.change(combo, { target: { value: 'subject-1|class-1' } })
    fireEvent.change(screen.getByLabelText('Term'), { target: { value: 'term-1' } })
    const scoreInput = await screen.findByLabelText('Score')

    scoreInput.focus()
    fireEvent.change(scoreInput, { target: { value: '4' } })
    fireEvent.change(scoreInput, { target: { value: '45' } })
    fireEvent.change(scoreInput, { target: { value: '450' } })

    expect(scoreInput).toBe(document.activeElement)
  })

  it('saves scores via the bulk endpoint', async () => {
    renderPage()

    const combo = await screen.findByLabelText('Class & Subject')
    fireEvent.change(combo, { target: { value: 'subject-1|class-1' } })
    fireEvent.change(screen.getByLabelText('Term'), { target: { value: 'term-1' } })
    const scoreInput = await screen.findByLabelText('Score')
    fireEvent.change(scoreInput, { target: { value: '85.5' } })

    fireEvent.click(screen.getByRole('button', { name: 'Save scores' }))

    await waitFor(() => {
      expect(apiMock.sbaBulk).toHaveBeenCalledWith({
        subjectId: 'subject-1',
        classId: 'class-1',
        termId: 'term-1',
        entries: [{ pupilId: 'pupil-1', score: 85.5, maxScore: 100, comment: null }],
      })
    })
    expect(pushMock).toHaveBeenCalledWith('success', '1 score(s) saved.')
  })

  it('shows read-only mode when not assigned, and disables editing', async () => {
    apiMock.sbaEntryData.mockResolvedValue(entryFixture({ access: 'view' }))
    renderPage()

    const combo = await screen.findByLabelText('Class & Subject')
    fireEvent.change(combo, { target: { value: 'subject-1|class-1' } })
    fireEvent.change(screen.getByLabelText('Term'), { target: { value: 'term-1' } })

    await screen.findByText('Ama Mensah')
    expect(screen.getByText('Read-only — you are not assigned here')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Save scores' })).not.toBeInTheDocument()
    expect(screen.getByLabelText('Score')).toBeDisabled()
  })
})