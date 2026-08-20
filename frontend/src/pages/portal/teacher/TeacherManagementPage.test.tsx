import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { TeacherManagementPage } from './TeacherManagementPage'
import type { TeacherListRow } from '@/types/portal'

const apiMock = vi.hoisted(() => ({
  listTeachers: vi.fn(),
}))

vi.mock('@/lib/api', () => ({ api: apiMock }))

let PERMISSIONS: string[] = []

vi.mock('@/auth/AuthContext', () => ({
  useAuth: () => ({
    user: {
      id: 'acc-1',
      fullName: 'Ada Lovelace',
      email: 'ada@school.edu',
      phone: null,
      profilePictureUrl: null,
      status: 'ACTIVE',
      lastLoginAt: null,
      mustChangePassword: false,
      createdAt: '2026-01-01T00:00:00.000Z',
      staffId: 'PRPS-ACC-001',
      category: 'ACADEMIC',
      position: null,
      roles: ['ASSISTANT_HEADTEACHER'],
      permissions: PERMISSIONS,
    },
    hasPermission: (key: string) => PERMISSIONS.includes(key),
  }),
}))

function teacherFixture(overrides: Partial<TeacherListRow> = {}): TeacherListRow {
  return {
    id: 'teacher-1',
    fullName: 'Kofi Mensah',
    email: 'kofi@school.edu',
    phone: null,
    status: 'ACTIVE',
    staffId: 'PRPS-T-0001',
    position: 'SUBJECT_TEACHER',
    positionLabel: 'Subject Teacher',
    roleNames: ['SUBJECT_TEACHER'],
    assignmentCount: 2,
    classTeacherClassCount: 1,
    sbaRecordCount: 5,
    ...overrides,
  }
}

function renderPage() {
  return render(
    <MemoryRouter>
      <TeacherManagementPage />
    </MemoryRouter>,
  )
}

describe('TeacherManagementPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    apiMock.listTeachers.mockResolvedValue([teacherFixture()])
  })

  it('shows a permission error when teachers.view is missing', async () => {
    PERMISSIONS = []
    renderPage()

    expect(await screen.findByText('Permission required')).toBeInTheDocument()
    expect(apiMock.listTeachers).not.toHaveBeenCalled()
  })

  it('renders the teacher list with assignments and SBA counts', async () => {
    PERMISSIONS = ['teachers.view']
    renderPage()

    expect(await screen.findByText('Kofi Mensah')).toBeInTheDocument()
    expect(screen.getByText('PRPS-T-0001')).toBeInTheDocument()
    expect(screen.getByText('Subject Teacher')).toBeInTheDocument()
    expect(screen.getAllByText('2').length).toBeGreaterThan(0)
    expect(screen.getByText('5')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /View/i })).toHaveAttribute('href', '/teacher-1')
  })

  it('shows an empty state when there are no teaching staff', async () => {
    PERMISSIONS = ['teachers.view']
    apiMock.listTeachers.mockResolvedValue([])
    renderPage()

    expect(await screen.findByText('No teaching staff found.')).toBeInTheDocument()
  })
})