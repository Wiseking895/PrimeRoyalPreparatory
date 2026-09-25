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
  assignClassTeacher: vi.fn(),
  removeClassTeacher: vi.fn(),
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
    apiMock.assignClassTeacher.mockResolvedValue(classTeacherFixture())
    apiMock.removeClassTeacher.mockResolvedValue(null)
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

  // -------------------------------------------------------------------------
  // NO auto-association: a class with no class-teacher row shows no teacher
  // -------------------------------------------------------------------------

  it('does NOT show any teacher against an unassigned class (regression: teacher appearing everywhere)', async () => {
    PERMISSIONS = ['teachers.view', 'assignments.manage']
    apiMock.getClassTeacher.mockResolvedValue(null)
    apiMock.listTeachingAssignments.mockResolvedValue([])
    renderPage()

    expect(await screen.findByText('Class teacher assignment')).toBeInTheDocument()
    expect(screen.getByText('No class teacher assigned')).toBeInTheDocument()

    const select = screen.getByLabelText('Teacher', { selector: '#class-teacher-class-1' }) as HTMLSelectElement
    expect(select.value).toBe('')
    expect(select.options[select.selectedIndex].textContent).toBe('Select a teacher')
    expect(screen.queryByText('Current class teacher: Kofi Mensah')).not.toBeInTheDocument()
  })

  it('shows only the assigned class teacher when one class has an assignment and the other does not', async () => {
    PERMISSIONS = ['teachers.view', 'assignments.manage']
    apiMock.listClasses.mockResolvedValue([
      classFixture({ id: 'nursery-1a', key: 'N1A', name: 'Nursery 1A' }),
      classFixture({ id: 'nursery-1b', key: 'N1B', name: 'Nursery 1B', sortOrder: 2 }),
    ])
    apiMock.getClassTeacher.mockImplementation(async (classId: string) =>
      classId === 'nursery-1a' ? classTeacherFixture({ classId: 'nursery-1a', className: 'Nursery 1A' }) : null,
    )
    renderPage()

    expect(await screen.findByText('Current class teacher: Kofi Mensah')).toBeInTheDocument()
    expect(screen.getByText('No class teacher assigned')).toBeInTheDocument()

    const assignedSelect = screen.getByLabelText('Teacher', { selector: '#class-teacher-nursery-1a' }) as HTMLSelectElement
    const unassignedSelect = screen.getByLabelText('Teacher', { selector: '#class-teacher-nursery-1b' }) as HTMLSelectElement
    expect(assignedSelect.value).toBe('teacher-1')
    expect(unassignedSelect.value).toBe('')
  })

  // -------------------------------------------------------------------------
  // Explicit assignment flow
  // -------------------------------------------------------------------------

  it('does not call the API when Assign is clicked without selecting a teacher', async () => {
    PERMISSIONS = ['teachers.view', 'assignments.manage']
    apiMock.getClassTeacher.mockResolvedValue(null)
    renderPage()

    await screen.findByText('Class teacher assignment')
    fireEvent.click(screen.getByRole('button', { name: 'Assign' }))

    expect(pushMock).toHaveBeenCalledWith('error', 'Select a teacher to assign.')
    expect(apiMock.assignClassTeacher).not.toHaveBeenCalled()
  })

  it('assigns a teacher to the selected class only, then reloads from the backend', async () => {
    PERMISSIONS = ['teachers.view', 'assignments.manage']
    apiMock.listClasses.mockResolvedValue([
      classFixture({ id: 'basic-3', key: 'B3', name: 'Basic 3' }),
      classFixture({ id: 'basic-4', key: 'B4', name: 'Basic 4', sortOrder: 2 }),
    ])
    apiMock.getClassTeacher
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockImplementation(async (classId: string) =>
        classId === 'basic-3' ? classTeacherFixture({ classId: 'basic-3', className: 'Basic 3' }) : null,
      )
    renderPage()

    await screen.findByText('Class teacher assignment')
    fireEvent.change(screen.getByLabelText('Teacher', { selector: '#class-teacher-basic-3' }), {
      target: { value: 'teacher-1' },
    })
    fireEvent.click(screen.getAllByRole('button', { name: 'Assign' })[0])

    await waitFor(() => {
      expect(apiMock.assignClassTeacher).toHaveBeenCalledWith('basic-3', 'teacher-1')
    })
    expect(apiMock.assignClassTeacher).toHaveBeenCalledTimes(1)
    expect(apiMock.assignClassTeacher).not.toHaveBeenCalledWith('basic-4', expect.anything())
    expect(pushMock).toHaveBeenCalledWith('success', 'Class teacher assigned.')

    // Refreshed from the backend: Basic 3 now shows the teacher, Basic 4 does not.
    expect(await screen.findByText('Current class teacher: Kofi Mensah')).toBeInTheDocument()
    expect(screen.getAllByText('No class teacher assigned')).toHaveLength(1)
  })

  it('reloads the page data from the backend after assignment (persistence via DB)', async () => {
    PERMISSIONS = ['teachers.view', 'assignments.manage']
    apiMock.getClassTeacher.mockResolvedValue(null)
    renderPage()
    await screen.findByText('Class teacher assignment')

    fireEvent.change(screen.getByLabelText('Teacher', { selector: '#class-teacher-class-1' }), {
      target: { value: 'teacher-1' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Assign' }))
    await waitFor(() => expect(apiMock.assignClassTeacher).toHaveBeenCalled())

    // load() re-fetches every source of truth after a successful assign
    expect(apiMock.getClassTeacher).toHaveBeenCalledTimes(2)
    expect(apiMock.listTeachingAssignments).toHaveBeenCalledTimes(2)
    expect(apiMock.listClasses).toHaveBeenCalledTimes(2)
  })

  it('removes a class teacher; the class reverts to unassigned on reload (TEST 7)', async () => {
    PERMISSIONS = ['teachers.view', 'assignments.manage']
    apiMock.getClassTeacher.mockResolvedValueOnce(classTeacherFixture()).mockResolvedValue(null)
    renderPage()

    expect(await screen.findByText('Current class teacher: Kofi Mensah')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Remove class teacher for Primary 1' }))

    await waitFor(() => {
      expect(apiMock.removeClassTeacher).toHaveBeenCalledWith('class-1')
    })
    expect(apiMock.removeClassTeacher).toHaveBeenCalledTimes(1)
    expect(await screen.findByText('No class teacher assigned')).toBeInTheDocument()
    expect(screen.queryByText('Current class teacher: Kofi Mensah')).not.toBeInTheDocument()
  })
})