import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { TeacherAssignmentPage } from './TeacherAssignmentPage'
import type { ClassTeacherView, SchoolClassView, SubjectView, TeacherAssignmentView, TeacherListRow } from '@/types/portal'

const apiMock = vi.hoisted(() => ({
  listTeachers: vi.fn(),
  listSubjects: vi.fn(),
  listClasses: vi.fn(),
  listTeachingAssignments: vi.fn(),
  getClassTeacher: vi.fn(),
  assignTeachingAssignment: vi.fn(),
  deactivateTeachingAssignment: vi.fn(),
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

const pushMock = vi.hoisted(() => vi.fn())

vi.mock('@/components/dashboard/Toast', () => ({
  useToast: () => ({ push: pushMock }),
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
    assignmentCount: 0,
    classTeacherClassCount: 0,
    sbaRecordCount: 0,
    ...overrides,
  }
}

function subjectFixture(overrides: Partial<SubjectView> = {}): SubjectView {
  return {
    id: 'subject-1',
    code: 'MATH',
    name: 'Mathematics',
    description: null,
    status: 'ACTIVE',
    assignmentCount: 1,
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt: '2026-08-01T00:00:00.000Z',
    ...overrides,
  }
}

function classFixture(overrides: Partial<SchoolClassView> = {}): SchoolClassView {
  return {
    id: 'class-1',
    key: 'P1',
    name: 'Primary 1',
    description: null,
    sortOrder: 1,
    status: 'ACTIVE',
    pupilCount: 20,
    activePupilCount: 18,
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt: '2026-08-01T00:00:00.000Z',
    ...overrides,
  }
}

function assignmentFixture(overrides: Partial<TeacherAssignmentView> = {}): TeacherAssignmentView {
  return {
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
    ...overrides,
  }
}

function classTeacherFixture(overrides: Partial<ClassTeacherView> = {}): ClassTeacherView {
  return {
    id: 'ct-1',
    classId: 'class-1',
    className: 'Primary 1',
    teacherId: 'teacher-1',
    teacherName: 'Kofi Mensah',
    createdAt: '2026-08-01T00:00:00.000Z',
    ...overrides,
  }
}

function renderPage() {
  return render(
    <MemoryRouter>
      <TeacherAssignmentPage />
    </MemoryRouter>,
  )
}

describe('TeacherAssignmentPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    pushMock.mockReset()
    apiMock.listTeachers.mockResolvedValue([teacherFixture()])
    apiMock.listSubjects.mockResolvedValue([subjectFixture()])
    apiMock.listClasses.mockResolvedValue([classFixture()])
    apiMock.listTeachingAssignments.mockResolvedValue([assignmentFixture()])
    apiMock.getClassTeacher.mockResolvedValue(classTeacherFixture())
    apiMock.assignTeachingAssignment.mockResolvedValue(assignmentFixture())
  })

  it('renders the teaching assignments list', async () => {
    PERMISSIONS = ['teachers.view', 'assignments.manage']
    renderPage()

    expect(await screen.findByText('Teaching assignments')).toBeInTheDocument()
    expect(screen.getAllByText('Kofi Mensah').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Primary 1').length).toBeGreaterThan(0)
  })

  it('hides the assignment form for read-only roles', async () => {
    PERMISSIONS = ['teachers.view']
    renderPage()

    await screen.findByText('Teaching assignments')
    expect(screen.queryByRole('button', { name: 'Assign teacher' })).not.toBeInTheDocument()
    expect(screen.queryByText('New teaching assignment')).not.toBeInTheDocument()
  })

  it('assigns a teacher to a subject and class', async () => {
    PERMISSIONS = ['teachers.view', 'assignments.manage']
    renderPage()

    await screen.findByText('Teaching assignments')
    fireEvent.change(screen.getByLabelText('Teacher', { selector: '#teacher' }), { target: { value: 'teacher-1' } })
    fireEvent.change(screen.getByLabelText('Subject', { selector: '#subject' }), { target: { value: 'subject-1' } })
    fireEvent.change(screen.getByLabelText('Class', { selector: '#class' }), { target: { value: 'class-1' } })
    fireEvent.click(screen.getByRole('button', { name: 'Assign teacher' }))

    await waitFor(() => {
      expect(apiMock.assignTeachingAssignment).toHaveBeenCalledWith({
        teacherId: 'teacher-1',
        subjectId: 'subject-1',
        classId: 'class-1',
      })
    })
    expect(pushMock).toHaveBeenCalledWith('success', 'Teacher assigned.')
  })

  it('shows the class teacher for each class', async () => {
    PERMISSIONS = ['teachers.view', 'assignments.manage']
    renderPage()

    expect(await screen.findByText('Class teacher assignment')).toBeInTheDocument()
    expect(screen.getByText('Current class teacher: Kofi Mensah')).toBeInTheDocument()
  })
})