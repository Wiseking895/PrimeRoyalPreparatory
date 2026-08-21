import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

vi.mock('@/auth/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'u1', fullName: 'Test User', roles: ['OWNER'] },
    hasPermission: () => true,
    logout: vi.fn(),
  }),
}))

vi.mock('@/lib/api', () => ({
  api: {
    unreadNotificationCount: vi.fn().mockResolvedValue({ count: 3 }),
    listNotifications: vi.fn().mockResolvedValue({
      items: [
        {
          id: 'n1',
          recipientId: 'u1',
          type: 'announcement',
          title: 'Test Notification',
          message: 'This is a test notification.',
          read: false,
          link: null,
          resourceType: null,
          resourceId: null,
          metadata: null,
          createdAt: new Date().toISOString(),
        },
      ],
      total: 1,
      unreadCount: 1,
    }),
    markNotificationRead: vi.fn().mockResolvedValue({}),
    markAllNotificationsRead: vi.fn().mockResolvedValue({ updated: 1 }),
  },
}))

import { NotificationBell } from '@/components/dashboard/NotificationBell'

function renderBell() {
  return render(
    <MemoryRouter>
      <NotificationBell />
    </MemoryRouter>,
  )
}

describe('NotificationBell', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders the bell icon', () => {
    renderBell()
    expect(screen.getByRole('button', { name: /notifications/i })).toBeInTheDocument()
  })

  it('shows unread count badge', async () => {
    renderBell()
    await waitFor(() => {
      expect(screen.getByText('3')).toBeInTheDocument()
    })
  })

  it('opens dropdown on click', async () => {
    renderBell()
    const bell = screen.getByRole('button', { name: /notifications/i })
    fireEvent.click(bell)

    await waitFor(() => {
      expect(screen.getByText('Notifications')).toBeInTheDocument()
    })
  })

  it('shows notification items in dropdown', async () => {
    renderBell()
    fireEvent.click(screen.getByRole('button', { name: /notifications/i }))

    await waitFor(() => {
      expect(screen.getByText('Test Notification')).toBeInTheDocument()
      expect(screen.getByText('This is a test notification.')).toBeInTheDocument()
    })
  })

  it('shows mark all read button when there are unread notifications', async () => {
    renderBell()
    fireEvent.click(screen.getByRole('button', { name: /notifications/i }))

    await waitFor(() => {
      expect(screen.getByText('Mark all read')).toBeInTheDocument()
    })
  })

  it('shows empty state when no notifications', async () => {
    const { api } = await import('@/lib/api')
    vi.mocked(api.listNotifications).mockResolvedValueOnce({ items: [], total: 0, unreadCount: 0 })

    renderBell()
    fireEvent.click(screen.getByRole('button', { name: /notifications/i }))

    await waitFor(() => {
      expect(screen.getByText('No notifications yet.')).toBeInTheDocument()
    })
  })
})
