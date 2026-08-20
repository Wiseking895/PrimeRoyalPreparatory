import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { TeacherDashboardPage } from './TeacherDashboardPage'
import type { AcademicStatsView, TeacherPortalView } from '@/types/portal'

const apiMock = vi.hoisted(() => ({
  academicMe: vi.fn(),
  academicStats: vi.fn(),
}))

vi.mock('@/lib/api', () => ({ api: apiMock }))

let PERMISSIONS: string[] = []

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
      permissions: PERMISSIONS,
    },
    hasPermission: (key: string) => PERMISSIONS.includes(key),
  }),
}))

function portalFixture(overrides: Partial<TeacherPortalView> = {}): TeacherPortalView {
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
    classesAsClassTeacher: [{ classId: 'class-1', className: 'Primary 1', pupilCount: 18 }],
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
        pupilCount: 18,
        sbaEnteredCount: 3,
        createdAt: '2026-08-01T00:00:00.000Z',
      },
    ],
    sba: { totalEntered: 3, recordsCurrentTerm: 2 },
    recentSba: [
      {
        id: 'sba-1',
        pupilName: 'Ama Mensah',
        subjectName: 'Mathematics',
        className: 'Primary 1',
        termName: 'First Term',
        score: '85.5',
        maxScore: '100',
        updatedAt: '2026-08-10T00:00:00.000Z',
      },
    ],
    ...overrides,
  }
}

function statsFixture(): AcademicStatsView {
  return {
    teachers: { total: 5, active: 4, inactive: 1 },
    classes: 3,
    subjects: { total: 4, active: 3 },
    assignments: { total: 2, active: 2 },
    classTeachersAssigned: 1,
    sba: { total: 12, recordsCurrentTerm: 4 },
  }
}

function renderPage() {
  return render(
    <MemoryRouter>
      <TeacherDashboardPage />
    </MemoryRouter>,
  )
}

describe('TeacherDashboardPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    apiMock.academicMe.mockResolvedValue(portalFixture())
    apiMock.academicStats.mockResolvedValue(statsFixture())
  })

  it('renders the greeting, assignments and recent SBA entries', async () => {
    PERMISSIONS = ['academic.view', 'sba.view', 'sba.manage']
    renderPage()

    expect(await screen.findByText(/Subject Teacher · Staff ID PRPS-T-0001/)).toBeInTheDocument()
    expect(screen.getByText('Mathematics — Primary 1')).toBeInTheDocument()
    expect(screen.getByText('Ama Mensah')).toBeInTheDocument()
    expect(screen.getByText('85.5')).toBeInTheDocument()
    expect(screen.getAllByText('Enter scores').length).toBeGreaterThan(0)
  })

  it('does not request academic stats without academic.view', async () => {
    PERMISSIONS = ['sba.view', 'sba.manage']
    renderPage()

    await screen.findByText('Mathematics — Primary 1')
    expect(apiMock.academicStats).not.toHaveBeenCalled()
    expect(screen.queryByText('Teaching Staff')).not.toBeInTheDocument()
  })

  it('shows an empty state when the teacher has no assignments', async () => {
    PERMISSIONS = ['academic.view', 'sba.view', 'sba.manage']
    apiMock.academicMe.mockResolvedValue({ ...portalFixture(), teachingAssignments: [] })
    renderPage()

    expect(await screen.findByText('No teaching assignments yet.')).toBeInTheDocument()
  })
})