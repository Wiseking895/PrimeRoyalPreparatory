import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ClassManagementPage } from './ClassManagementPage'
import type { SchoolClassView } from '@/types/portal'

const apiMock = vi.hoisted(() => ({
  listClasses: vi.fn(),
  createClass: vi.fn(),
  updateClass: vi.fn(),
  setClassStatus: vi.fn(),
}))

vi.mock('@/lib/api', () => ({ api: apiMock }))

const CLASS_PERMISSIONS = ['classes.view', 'classes.manage']

vi.mock('@/auth/AuthContext', () => ({
  useAuth: () => ({
    user: {
      id: 'ht-1',
      fullName: 'Grace Hopper',
      email: 'grace@school.edu',
      phone: null,
      profilePictureUrl: null,
      status: 'ACTIVE',
      lastLoginAt: null,
      mustChangePassword: false,
      createdAt: '2026-01-01T00:00:00.000Z',
      staffId: 'PRPS-HT-001',
      category: 'LEADERSHIP',
      position: null,
      roles: ['HEADTEACHER'],
      permissions: CLASS_PERMISSIONS,
    },
    hasPermission: (key: string) => CLASS_PERMISSIONS.includes(key),
  }),
}))

const pushMock = vi.hoisted(() => vi.fn())

vi.mock('@/components/dashboard/Toast', () => ({
  useToast: () => ({ push: pushMock }),
}))

function classFixture(overrides: Partial<SchoolClassView> = {}): SchoolClassView {
  return {
    id: 'class-1',
    key: 'PRIMARY_1',
    name: 'Primary 1',
    description: null,
    sortOrder: 0,
    status: 'ACTIVE',
    pupilCount: 1,
    activePupilCount: 1,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/headteacher/classes']}>
      <ClassManagementPage />
    </MemoryRouter>,
  )
}

describe('ClassManagementPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    pushMock.mockReset()
    apiMock.listClasses.mockResolvedValue([classFixture()])
    apiMock.createClass.mockResolvedValue(classFixture({ id: 'class-2', key: 'PRIMARY_2', name: 'Primary 2' }))
    apiMock.updateClass.mockResolvedValue(classFixture({ name: 'Grade 1' }))
    apiMock.setClassStatus.mockResolvedValue(classFixture({ status: 'INACTIVE' }))
  })

  it('renders the classes list', async () => {
    renderPage()

    expect(await screen.findAllByText('Primary 1')).toBeTruthy()
    expect(screen.getByText('PRIMARY_1')).toBeInTheDocument()
    expect(screen.getAllByText('Active').length).toBeGreaterThan(0)
    expect(screen.getByText('Total Classes')).toBeInTheDocument()
  })

  it('creates a class', async () => {
    renderPage()
    await screen.findAllByText('Primary 1')

    fireEvent.click(screen.getByRole('button', { name: 'Add Class' }))
    fireEvent.change(screen.getByLabelText(/^Class key/), { target: { value: 'PRIMARY_2' } })
    fireEvent.change(screen.getByLabelText(/^Class name/), { target: { value: 'Primary 2' } })
    fireEvent.click(screen.getByRole('button', { name: 'Create class' }))

    await waitFor(() => {
      expect(apiMock.createClass).toHaveBeenCalledWith(
        expect.objectContaining({ key: 'PRIMARY_2', name: 'Primary 2' }),
      )
    })
    expect(pushMock).toHaveBeenCalledWith('success', expect.stringContaining('created'))
  })

  it('edits a class', async () => {
    renderPage()
    await screen.findAllByText('Primary 1')

    fireEvent.click(screen.getAllByRole('button', { name: 'Edit' })[0])
    const name = screen.getByLabelText(/^Class name/)
    fireEvent.change(name, { target: { value: 'Grade 1' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }))

    await waitFor(() => {
      expect(apiMock.updateClass).toHaveBeenCalledWith('class-1', expect.objectContaining({ name: 'Grade 1' }))
    })
    expect(pushMock).toHaveBeenCalledWith('success', expect.stringContaining('updated'))
  })

  it('deactivates a class via the confirmation dialog', async () => {
    renderPage()
    await screen.findAllByText('Primary 1')

    fireEvent.click(screen.getByRole('button', { name: 'Deactivate' }))

    const dialog = await screen.findByRole('dialog', { name: 'Deactivate class' })
    fireEvent.click(screen.getByRole('checkbox'))
    fireEvent.click(within(dialog).getByRole('button', { name: 'Deactivate' }))

    await waitFor(() => {
      expect(apiMock.setClassStatus).toHaveBeenCalledWith('class-1', 'INACTIVE')
    })
    expect(pushMock).toHaveBeenCalledWith(
      'success',
      expect.stringContaining('deactivated'),
    )
  })

  it('keeps input focus while typing in the create form', async () => {
    renderPage()
    await screen.findAllByText('Primary 1')

    fireEvent.click(screen.getByRole('button', { name: 'Add Class' }))
    const key = screen.getByLabelText(/^Class key/)
    key.focus()

    fireEvent.change(key, { target: { value: 'P' } })
    fireEvent.change(key, { target: { value: 'PR' } })
    fireEvent.change(key, { target: { value: 'PRIMARY_2' } })

    expect(key).toBe(document.activeElement)
  })

  it('shows an empty state when there are no classes', async () => {
    apiMock.listClasses.mockResolvedValue([])
    renderPage()

    expect(await screen.findByText('No classes have been created yet.')).toBeInTheDocument()
  })

  it('defaults the optional Division field to Undivided', async () => {
    renderPage()
    await screen.findAllByText('Primary 1')

    fireEvent.click(screen.getByRole('button', { name: 'Add Class' }))

    const division = screen.getByLabelText(/^Division/)
    expect(division).toBeInTheDocument()
    expect(division).toHaveValue('UNDIVIDED')
    expect(screen.getByRole('option', { name: 'Undivided' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'A' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'B' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'C' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'D' })).toBeInTheDocument()
  })

  it('creates an undivided class and never appends "Undivided" to the display', async () => {
    apiMock.createClass.mockResolvedValue(
      classFixture({ id: 'class-n1', key: 'NURSERY_1', name: 'Nursery 1', classLevel: 'Nursery 1', division: null }),
    )
    renderPage()
    await screen.findAllByText('Primary 1')

    fireEvent.click(screen.getByRole('button', { name: 'Add Class' }))
    fireEvent.change(screen.getByLabelText(/^Class key/), { target: { value: 'NURSERY_1' } })
    fireEvent.change(screen.getByLabelText(/^Class name/), { target: { value: 'Nursery 1' } })
    fireEvent.click(screen.getByRole('button', { name: 'Create class' }))

    await waitFor(() => {
      expect(apiMock.createClass).toHaveBeenCalledWith(
        expect.objectContaining({ key: 'NURSERY_1', name: 'Nursery 1', division: null }),
      )
    })
    expect((await screen.findAllByText('Nursery 1')).length).toBeGreaterThan(0)
    expect(screen.queryByText('Nursery 1 Undivided')).not.toBeInTheDocument()
    expect(pushMock).toHaveBeenCalledWith('success', 'Nursery 1 created.')
  })

  it('creates a divided class (Nursery 1A) with division A', async () => {
    apiMock.createClass.mockResolvedValue(
      classFixture({
        id: 'class-n1a',
        key: 'NURSERY_1_A',
        name: 'Nursery 1A',
        classLevel: 'Nursery 1',
        division: 'A',
      }),
    )
    renderPage()
    await screen.findAllByText('Primary 1')

    fireEvent.click(screen.getByRole('button', { name: 'Add Class' }))
    fireEvent.change(screen.getByLabelText(/^Class key/), { target: { value: 'NURSERY_1_A' } })
    fireEvent.change(screen.getByLabelText(/^Class name/), { target: { value: 'Nursery 1' } })
    fireEvent.change(screen.getByLabelText(/^Division/), { target: { value: 'A' } })
    fireEvent.click(screen.getByRole('button', { name: 'Create class' }))

    await waitFor(() => {
      expect(apiMock.createClass).toHaveBeenCalledWith(
        expect.objectContaining({ key: 'NURSERY_1_A', name: 'Nursery 1', division: 'A' }),
      )
    })
    expect((await screen.findAllByText('Nursery 1A')).length).toBeGreaterThan(0)
    expect(pushMock).toHaveBeenCalledWith('success', 'Nursery 1A created.')
  })

  it('displays undivided and divided classes with their exact display names', async () => {
    apiMock.listClasses.mockResolvedValue([
      classFixture({ id: 'c1', key: 'CRECHE', name: 'Creche', classLevel: 'Creche', division: null }),
      classFixture({ id: 'c2', key: 'NURSERY_1', name: 'Nursery 1', classLevel: 'Nursery 1', division: null }),
      classFixture({ id: 'c3', key: 'NURSERY_1_A', name: 'Nursery 1A', classLevel: 'Nursery 1', division: 'A' }),
      classFixture({ id: 'c4', key: 'NURSERY_1_B', name: 'Nursery 1B', classLevel: 'Nursery 1', division: 'B' }),
      classFixture({ id: 'c5', key: 'BASIC_6_D', name: 'Basic 6D', classLevel: 'Basic 6', division: 'D' }),
    ])
    renderPage()

    expect((await screen.findAllByText('Creche')).length).toBeGreaterThan(0)
    expect(screen.getAllByText('Nursery 1').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Nursery 1A').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Nursery 1B').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Basic 6D').length).toBeGreaterThan(0)
    expect(screen.queryByText('Nursery 1 Undivided')).not.toBeInTheDocument()
  })

  it('edits a class division without creating a duplicate record', async () => {
    apiMock.listClasses.mockResolvedValue([
      classFixture({ id: 'class-1', key: 'BASIC_3_A', name: 'Basic 3A', classLevel: 'Basic 3', division: 'A' }),
    ])
    renderPage()
    await screen.findAllByText('Basic 3A')

    fireEvent.click(screen.getAllByRole('button', { name: 'Edit' })[0])

    expect(screen.getByLabelText(/^Class name/)).toHaveValue('Basic 3')
    expect(screen.getByLabelText(/^Division/)).toHaveValue('A')

    fireEvent.change(screen.getByLabelText(/^Division/), { target: { value: 'B' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }))

    await waitFor(() => {
      expect(apiMock.updateClass).toHaveBeenCalledWith(
        'class-1',
        expect.objectContaining({ name: 'Basic 3', division: 'B' }),
      )
    })
    expect(apiMock.createClass).not.toHaveBeenCalled()
    expect(pushMock).toHaveBeenCalledWith('success', expect.stringContaining('updated'))
  })

  it('removes a division by setting it back to Undivided on edit', async () => {
    apiMock.listClasses.mockResolvedValue([
      classFixture({ id: 'class-1', key: 'BASIC_3_A', name: 'Basic 3A', classLevel: 'Basic 3', division: 'A' }),
    ])
    renderPage()
    await screen.findAllByText('Basic 3A')

    fireEvent.click(screen.getAllByRole('button', { name: 'Edit' })[0])
    fireEvent.change(screen.getByLabelText(/^Division/), { target: { value: 'UNDIVIDED' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }))

    await waitFor(() => {
      expect(apiMock.updateClass).toHaveBeenCalledWith(
        'class-1',
        expect.objectContaining({ name: 'Basic 3', division: null }),
      )
    })
    expect(apiMock.createClass).not.toHaveBeenCalled()
  })
})