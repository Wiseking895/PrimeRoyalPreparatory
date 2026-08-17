import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { OwnerSetupPage } from './OwnerSetupPage'

const { setupStatusMock, createOwnerMock } = vi.hoisted(() => ({
  setupStatusMock: vi.fn(),
  createOwnerMock: vi.fn(),
}))

vi.mock('@/lib/api', () => ({
  api: {
    setupStatus: setupStatusMock,
    createOwner: createOwnerMock,
  },
}))

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/setup/owner']}>
      <OwnerSetupPage />
    </MemoryRouter>,
  )
}

describe('OwnerSetupPage', () => {
  beforeEach(() => {
    setupStatusMock.mockReset()
    createOwnerMock.mockReset()
    setupStatusMock.mockResolvedValue({ ownerExists: false })
    createOwnerMock.mockResolvedValue({ id: 'owner-1' })
  })

  it('renders the setup form when no owner exists', async () => {
    renderPage()

    expect(await screen.findByText('Set up your school')).toBeInTheDocument()
    expect(screen.getByLabelText(/^full name/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/^email/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/^password/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /create owner account/i })).toBeInTheDocument()
  })

  it('creates the owner and shows the success state', async () => {
    renderPage()

    fireEvent.change(await screen.findByLabelText(/^full name/i), { target: { value: 'Ada Lovelace' } })
    fireEvent.change(screen.getByLabelText(/^email/i), { target: { value: 'ada@example.com' } })
    fireEvent.change(screen.getByLabelText(/^password/i), { target: { value: 'secret123' } })
    fireEvent.change(screen.getByLabelText(/confirm password/i), { target: { value: 'secret123' } })
    fireEvent.click(screen.getByRole('button', { name: /create owner account/i }))

    expect(await screen.findByText('School set up successfully')).toBeInTheDocument()
    expect(createOwnerMock).toHaveBeenCalledWith({
      fullName: 'Ada Lovelace',
      email: 'ada@example.com',
      phone: undefined,
      password: 'secret123',
      confirmPassword: 'secret123',
    })
  })

  it('shows validation errors for an invalid form', async () => {
    renderPage()

    fireEvent.change(await screen.findByLabelText(/email/i), { target: { value: 'not-an-email' } })
    fireEvent.click(screen.getByRole('button', { name: /create owner account/i }))

    expect(await screen.findByText('Full name must be at least 3 characters.')).toBeInTheDocument()
    expect(screen.getByText('Enter a valid email address.')).toBeInTheDocument()
    expect(createOwnerMock).not.toHaveBeenCalled()
  })

  it('shows the already-complete screen when an owner exists', async () => {
    setupStatusMock.mockResolvedValueOnce({ ownerExists: true })
    renderPage()

    expect(await screen.findByText('Setup is already complete')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /go to staff sign in/i })).toHaveAttribute('href', '/login')
  })

  it('surfaces a setup status error with a retry action', async () => {
    setupStatusMock.mockRejectedValueOnce(new Error('Cannot reach the server.'))
    renderPage()

    expect(await screen.findByText('Cannot reach the server.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument()
  })
})