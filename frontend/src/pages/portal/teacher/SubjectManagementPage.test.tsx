import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { SubjectManagementPage } from './SubjectManagementPage'
import type { SubjectView } from '@/types/portal'

const apiMock = vi.hoisted(() => ({
  listSubjects: vi.fn(),
  createSubject: vi.fn(),
  updateSubject: vi.fn(),
  setSubjectStatus: vi.fn(),
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

function subjectFixture(overrides: Partial<SubjectView> = {}): SubjectView {
  return {
    id: 'subject-1',
    code: 'MATH',
    name: 'Mathematics',
    description: 'Core numeracy',
    status: 'ACTIVE',
    assignmentCount: 2,
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt: '2026-08-01T00:00:00.000Z',
    ...overrides,
  }
}

function renderPage() {
  return render(
    <MemoryRouter>
      <SubjectManagementPage />
    </MemoryRouter>,
  )
}

describe('SubjectManagementPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    pushMock.mockReset()
    apiMock.listSubjects.mockResolvedValue([subjectFixture()])
    apiMock.createSubject.mockResolvedValue(subjectFixture({ code: 'SCI', name: 'Science' }))
  })

  it('renders the subject list', async () => {
    PERMISSIONS = ['subjects.view']
    renderPage()

    expect(await screen.findByText('Mathematics')).toBeInTheDocument()
    expect(screen.getByText('MATH')).toBeInTheDocument()
    expect(screen.getByText('Core numeracy')).toBeInTheDocument()
    expect(screen.getAllByText('Active').length).toBeGreaterThan(0)
  })

  it('hides create and edit actions for view-only roles', async () => {
    PERMISSIONS = ['subjects.view']
    renderPage()

    await screen.findByText('Mathematics')
    expect(screen.queryByRole('button', { name: 'New subject' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Edit Mathematics/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Deactivate Mathematics/i })).not.toBeInTheDocument()
  })

  it('creates a subject from the modal', async () => {
    PERMISSIONS = ['subjects.view', 'subjects.manage']
    renderPage()

    await screen.findByText('Mathematics')
    fireEvent.click(screen.getByRole('button', { name: 'New subject' }))

    const dialog = await screen.findByRole('dialog', { name: 'New subject' })
    fireEvent.change(within(dialog).getByLabelText(/^Code/), { target: { value: 'SCI' } })
    fireEvent.change(within(dialog).getByLabelText(/^Name/), { target: { value: 'Science' } })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Create subject' }))

    await waitFor(() => {
      expect(apiMock.createSubject).toHaveBeenCalledWith({
        code: 'SCI',
        name: 'Science',
        description: undefined,
        status: 'ACTIVE',
      })
    })
    expect(pushMock).toHaveBeenCalledWith('success', 'Subject created.')
  })

  it('deactivates a subject through the confirm dialog', async () => {
    PERMISSIONS = ['subjects.view', 'subjects.manage']
    renderPage()

    await screen.findByText('Mathematics')
    fireEvent.click(screen.getByRole('button', { name: 'Deactivate Mathematics' }))
    const dialog = await screen.findByRole('dialog', { name: 'Deactivate subject?' })
    fireEvent.click(within(dialog).getByRole('checkbox'))
    fireEvent.click(within(dialog).getByRole('button', { name: 'Deactivate' }))

    await waitFor(() => {
      expect(apiMock.setSubjectStatus).toHaveBeenCalledWith('subject-1', 'INACTIVE')
    })
    expect(pushMock).toHaveBeenCalledWith('success', 'Subject deactivated.')
  })

  it('shows an empty state when there are no subjects', async () => {
    PERMISSIONS = ['subjects.view']
    apiMock.listSubjects.mockResolvedValue([])
    renderPage()

    expect(await screen.findByText('No subjects found.')).toBeInTheDocument()
  })
})