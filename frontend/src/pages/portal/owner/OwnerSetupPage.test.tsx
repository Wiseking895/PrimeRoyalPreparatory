import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthProvider } from '@/auth/AuthContext'
import { OwnerSetupPage } from './OwnerSetupPage'

const { setupStatusMock, createOwnerMock, meMock } = vi.hoisted(() => ({
  setupStatusMock: vi.fn(),
  createOwnerMock: vi.fn(),
  meMock: vi.fn(),
}))

vi.mock('@/lib/api', () => ({
  api: {
    setupStatus: setupStatusMock,
    createOwner: createOwnerMock,
    me: meMock,
    googleOAuthStartUrl: () => 'https://api.prps.test/api/auth/google/start',
  },
  setUnauthorizedHandler: vi.fn(),
}))

const OWNER_USER = {
  id: 'owner-1',
  fullName: 'Ada Lovelace',
  email: 'ada@example.com',
  phone: null,
  profilePictureUrl: null,
  status: 'ACTIVE',
  lastLoginAt: null,
  mustChangePassword: false,
  createdAt: '2026-01-01T00:00:00.000Z',
  staffId: null,
  category: null,
  position: null,
  roles: ['OWNER'],
  permissions: ['owner.manage'],
}

function renderPage(entry = '/setup/owner') {
  return render(
    <AuthProvider>
      <MemoryRouter initialEntries={[entry]}>
        <Routes>
          <Route path="/setup/owner" element={<OwnerSetupPage />} />
          <Route path="/owner/dashboard" element={<div>Owner dashboard</div>} />
          <Route path="/login" element={<div>Staff sign in</div>} />
        </Routes>
      </MemoryRouter>
    </AuthProvider>,
  )
}

async function openEmailForm() {
  fireEvent.click(await screen.findByRole('button', { name: /continue with email/i }))
  return screen.findByLabelText(/^full name/i)
}

describe('OwnerSetupPage', () => {
  beforeEach(() => {
    localStorage.clear()
    setupStatusMock.mockReset()
    createOwnerMock.mockReset()
    meMock.mockReset()
    setupStatusMock.mockResolvedValue({ ownerExists: false, googleOAuthEnabled: true })
    createOwnerMock.mockResolvedValue({ user: OWNER_USER, token: 'new-owner-token' })
  })

  it('offers Google and email sign-up when Google OAuth is available', async () => {
    renderPage()

    expect(await screen.findByText('Set up your Owner account')).toBeInTheDocument()
    expect(
      screen.getByText('Create the account that will manage Prime Royal Preparatory School.'),
    ).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /continue with google/i })).toHaveAttribute(
      'href',
      'https://api.prps.test/api/auth/google/start',
    )
    expect(screen.getByRole('button', { name: /continue with email/i })).toBeInTheDocument()
    expect(screen.queryByLabelText(/^full name/i)).not.toBeInTheDocument()
  })

  it('still offers both sign-up options when Google OAuth is not configured yet', async () => {
    setupStatusMock.mockResolvedValue({ ownerExists: false, googleOAuthEnabled: false })
    renderPage()

    expect(await screen.findByRole('link', { name: /continue with google/i })).toHaveAttribute(
      'href',
      'https://api.prps.test/api/auth/google/start',
    )
    expect(screen.getByRole('button', { name: /continue with email/i })).toBeInTheDocument()
    expect(screen.queryByLabelText(/^full name/i)).not.toBeInTheDocument()
  })

  it('reveals the email form and a way back to the choice screen', async () => {
    renderPage()

    await openEmailForm()
    expect(screen.getByLabelText(/^email/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^back$/i })).toBeInTheDocument()
  })

  it('creates the Owner account, authenticates it and lands in the Owner dashboard', async () => {
    renderPage()

    await openEmailForm()
    fireEvent.change(await screen.findByLabelText(/^full name/i), {
      target: { value: 'Ada Lovelace' },
    })
    fireEvent.change(screen.getByLabelText(/^email/i), { target: { value: 'ada@example.com' } })
    fireEvent.change(screen.getByLabelText(/^password/i), { target: { value: 'secret123' } })
    fireEvent.change(screen.getByLabelText(/confirm password/i), { target: { value: 'secret123' } })
    fireEvent.click(screen.getByRole('button', { name: /create owner account/i }))

    expect(await screen.findByText('Owner dashboard')).toBeInTheDocument()
    expect(createOwnerMock).toHaveBeenCalledWith({
      fullName: 'Ada Lovelace',
      email: 'ada@example.com',
      phone: undefined,
      password: 'secret123',
      confirmPassword: 'secret123',
    })
    // Registration authenticates the brand-new Owner without a stop at /login.
    expect(localStorage.getItem('prps.portal.token')).toBe('new-owner-token')
    expect(screen.queryByText(/staff sign in/i)).not.toBeInTheDocument()
  })

  it('shows validation errors for an invalid form', async () => {
    renderPage()

    await openEmailForm()
    fireEvent.change(await screen.findByLabelText(/email/i), { target: { value: 'not-an-email' } })
    fireEvent.click(screen.getByRole('button', { name: /create owner account/i }))

    expect(await screen.findByText('Full name must be at least 3 characters.')).toBeInTheDocument()
    expect(screen.getByText('Enter a valid email address.')).toBeInTheDocument()
    expect(createOwnerMock).not.toHaveBeenCalled()
  })

  it('rejects a password confirmation that does not match', async () => {
    renderPage()

    await openEmailForm()
    fireEvent.change(await screen.findByLabelText(/^full name/i), {
      target: { value: 'Ada Lovelace' },
    })
    fireEvent.change(screen.getByLabelText(/^email/i), { target: { value: 'ada@example.com' } })
    fireEvent.change(screen.getByLabelText(/^password/i), { target: { value: 'secret123' } })
    fireEvent.change(screen.getByLabelText(/confirm password/i), { target: { value: 'secret124' } })
    fireEvent.click(screen.getByRole('button', { name: /create owner account/i }))

    expect(await screen.findByText('Passwords do not match.')).toBeInTheDocument()
    expect(createOwnerMock).not.toHaveBeenCalled()
    expect(localStorage.getItem('prps.portal.token')).toBeNull()
  })

  it('shows the already-complete screen when an owner exists', async () => {
    setupStatusMock.mockResolvedValueOnce({ ownerExists: true, googleOAuthEnabled: false })
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

  it('explains a Google sign-in that the backend rejected', async () => {
    renderPage('/setup/owner?error=denied')

    expect(await screen.findByRole('alert')).toHaveTextContent(/Google sign-in was cancelled/i)
    expect(screen.getByRole('link', { name: /continue with google/i })).toBeInTheDocument()
  })

  it('accepts the session Google handed back and enters the dashboard', async () => {
    meMock.mockResolvedValue(OWNER_USER)
    renderPage('/setup/owner#token=google-session-token')

    expect(await screen.findByText('Owner dashboard')).toBeInTheDocument()
    expect(meMock).toHaveBeenCalled()
    expect(localStorage.getItem('prps.portal.token')).toBe('google-session-token')
  })

  it('recovers when a handed-back session cannot be loaded', async () => {
    meMock.mockRejectedValue(new Error('Invalid token.'))
    renderPage('/setup/owner#token=broken-token')

    expect(await screen.findByRole('link', { name: /continue with google/i })).toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent(/could not be completed/i)
    expect(localStorage.getItem('prps.portal.token')).toBeNull()
  })
})
