import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { OwnerHeadteacherPage } from './OwnerHeadteacherPage'
import type { StaffView } from '@/types/portal'

const apiMock = vi.hoisted(() => ({
  listHeadteachers: vi.fn(),
  createHeadteacher: vi.fn(),
  resendHeadteacherInvitation: vi.fn(),
  updateHeadteacher: vi.fn(),
  setHeadteacherStatus: vi.fn(),
}))
const pushMock = vi.hoisted(() => vi.fn())

vi.mock('@/lib/api', () => ({ api: apiMock }))
vi.mock('@/components/dashboard/Toast', () => ({ useToast: () => ({ push: pushMock }) }))

const DUPLICATE_MESSAGE =
  'An active Headteacher already exists. Deactivate the current Headteacher before creating a replacement.'

function headteacherFixture(overrides: Partial<StaffView> = {}): StaffView {
  return {
    id: 'ht-1',
    fullName: 'Kofi Mensah',
    email: 'kofi@school.edu',
    phone: null,
    profilePictureUrl: null,
    status: 'ACTIVE',
    lastLoginAt: null,
    mustChangePassword: false,
    createdAt: '2026-01-01T00:00:00.000Z',
    staffId: 'PRPS-HT-001',
    category: 'LEADERSHIP',
    position: null,
    address: 'Accra',
    dateJoined: '2026-01-01T00:00:00.000Z',
    responsibilities: null,
    roles: ['HEADTEACHER'],
    permissions: [],
    ...overrides,
  }
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/owner/headteacher']}>
      <OwnerHeadteacherPage />
    </MemoryRouter>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  apiMock.listHeadteachers.mockResolvedValue([])
})

describe('OwnerHeadteacherPage', () => {
  it('offers registration when no Headteacher exists yet', async () => {
    renderPage()

    expect(
      await screen.findByText('No Headteacher account has been created yet.'),
    ).toBeInTheDocument()

    const registerButtons = screen.getAllByRole('button', { name: /Create Headteacher/ })
    expect(registerButtons.length).toBeGreaterThan(0)
    for (const button of registerButtons) expect(button).toBeEnabled()
    expect(screen.queryByText('Current Headteacher')).not.toBeInTheDocument()
  })

  it('shows the current active Headteacher and blocks a second registration', async () => {
    apiMock.listHeadteachers.mockResolvedValue([headteacherFixture()])
    renderPage()

    expect(await screen.findByText('Current Headteacher')).toBeInTheDocument()
    expect(screen.getAllByText('Kofi Mensah').length).toBeGreaterThanOrEqual(2)
    expect(screen.getAllByText(/PRPS-HT-001/).length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('Active').length).toBeGreaterThanOrEqual(1)

    const registerButtons = screen.getAllByRole('button', { name: /Create Headteacher/ })
    expect(registerButtons.length).toBeGreaterThan(0)
    for (const button of registerButtons) expect(button).toBeDisabled()

    expect(screen.getByText(new RegExp(DUPLICATE_MESSAGE))).toBeInTheDocument()
  })

  it('keeps the existing Headteacher labels and styling hooks', async () => {
    apiMock.listHeadteachers.mockResolvedValue([headteacherFixture()])
    renderPage()

    expect(await screen.findByText('Headteacher Management')).toBeInTheDocument()
    expect(
      screen.getByText(/Only one active Headteacher may exist at a time\./),
    ).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: 'Deactivate' }).length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByRole('link', { name: 'Manage account' }).length).toBe(1)
    expect(screen.getAllByRole('link', { name: 'Permissions' }).length).toBe(1)
  })

  it('confirms inactivation, explains that history is preserved, and calls the API', async () => {
    apiMock.listHeadteachers
      .mockResolvedValueOnce([headteacherFixture()])
      .mockResolvedValueOnce([])
    apiMock.setHeadteacherStatus.mockResolvedValue(headteacherFixture({ status: 'INACTIVE' }))
    renderPage()

    const [panelDeactivate] = await screen.findAllByRole('button', { name: 'Deactivate' })
    fireEvent.click(panelDeactivate)

    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText('Deactivate Headteacher')).toBeInTheDocument()
    expect(
      within(dialog).getByText(/account, role assignment and historical records are kept in full/),
    ).toBeInTheDocument()
    expect(
      within(dialog).getByText(/replacement Headteacher can be registered immediately/),
    ).toBeInTheDocument()

    fireEvent.click(within(dialog).getByRole('checkbox'))
    fireEvent.click(within(dialog).getByRole('button', { name: 'Deactivate' }))

    await waitFor(() => {
      expect(apiMock.setHeadteacherStatus).toHaveBeenCalledWith('ht-1', 'INACTIVE')
    })
    expect(await screen.findByText('No Headteacher account has been created yet.')).toBeInTheDocument()
    expect(screen.queryByText('Current Headteacher')).not.toBeInTheDocument()
  })

  it('re-opens registration after the Headteacher is deactivated', async () => {
    apiMock.listHeadteachers
      .mockResolvedValueOnce([headteacherFixture()])
      .mockResolvedValueOnce([])
    apiMock.setHeadteacherStatus.mockResolvedValue(headteacherFixture({ status: 'INACTIVE' }))
    renderPage()

    const [panelDeactivate] = await screen.findAllByRole('button', { name: 'Deactivate' })
    fireEvent.click(panelDeactivate)

    const dialog = await screen.findByRole('dialog')
    fireEvent.click(within(dialog).getByRole('checkbox'))
    fireEvent.click(within(dialog).getByRole('button', { name: 'Deactivate' }))

    expect(await screen.findByText('No Headteacher account has been created yet.')).toBeInTheDocument()
    const registerButtons = screen.getAllByRole('button', { name: /Create Headteacher/ })
    expect(registerButtons.length).toBeGreaterThan(0)
    for (const button of registerButtons) expect(button).toBeEnabled()
    expect(screen.queryByText('Current Headteacher')).not.toBeInTheDocument()
  })

  it('shows the backend duplicate-active-Headteacher message clearly', async () => {
    apiMock.createHeadteacher.mockRejectedValue(new Error(DUPLICATE_MESSAGE))
    renderPage()

    fireEvent.click(await screen.findByRole('button', { name: /Create Headteacher/ }))
    fireEvent.change(screen.getByLabelText(/First name/), { target: { value: 'Ada' } })
    fireEvent.change(screen.getByLabelText(/Last name/), { target: { value: 'Lovelace' } })
    fireEvent.change(screen.getByLabelText(/Email/), {
      target: { value: 'ada@school.edu' },
    })
    fireEvent.click(screen.getByRole('button', { name: /Create account & send invitation/ }))

    await waitFor(() => {
      expect(pushMock).toHaveBeenCalledWith('error', DUPLICATE_MESSAGE)
    })
    expect(apiMock.createHeadteacher).toHaveBeenCalledTimes(1)
  })
})
