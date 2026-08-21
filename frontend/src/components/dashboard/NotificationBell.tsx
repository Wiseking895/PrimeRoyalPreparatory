import { useCallback, useEffect, useRef, useState } from 'react'
import { Bell } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { api } from '@/lib/api'
import { useAuth } from '@/auth/AuthContext'
import type { NotificationView } from '@/types/portal'
import { cn } from '@/lib/cn'

/**
 * Notification bell with unread badge and dropdown panel.
 * Placed in the dashboard header area. Polls for new notifications
 * every 60 seconds when the tab is visible.
 */
export function NotificationBell() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [unreadCount, setUnreadCount] = useState(0)
  const [notifications, setNotifications] = useState<NotificationView[]>([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const bellRef = useRef<HTMLButtonElement>(null)

  const fetchUnreadCount = useCallback(async () => {
    try {
      const result = await api.unreadNotificationCount()
      setUnreadCount(result.count)
    } catch {
      // Silently fail — notification bell is non-critical
    }
  }, [])

  const fetchRecentNotifications = useCallback(async () => {
    try {
      setLoading(true)
      const result = await api.listNotifications({ limit: 8 })
      setNotifications(result.items)
      setUnreadCount(result.unreadCount)
    } catch {
      // Silently fail
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!user) return
    fetchUnreadCount()

    const interval = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        fetchUnreadCount()
      }
    }, 60000)

    return () => window.clearInterval(interval)
  }, [user, fetchUnreadCount])

  useEffect(() => {
    if (open) {
      fetchRecentNotifications()
    }
  }, [open, fetchRecentNotifications])

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        bellRef.current &&
        !bellRef.current.contains(e.target as Node)
      ) {
        setOpen(false)
      }
    }
    if (open) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [open])

  const handleMarkRead = async (id: string) => {
    try {
      await api.markNotificationRead(id)
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read: true } : n)),
      )
      setUnreadCount((prev) => Math.max(0, prev - 1))
    } catch {
      // Silently fail
    }
  }

  const handleMarkAllRead = async () => {
    try {
      await api.markAllNotificationsRead()
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
      setUnreadCount(0)
    } catch {
      // Silently fail
    }
  }

  const handleViewAll = () => {
    setOpen(false)
    navigate('/owner/notifications')
  }

  return (
    <div className="relative">
      <button
        ref={bellRef}
        type="button"
        onClick={() => setOpen(!open)}
        className="relative inline-flex h-10 w-10 items-center justify-center rounded-xl text-cream-200/80 transition-colors hover:bg-white/10 hover:text-white"
        aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
        aria-expanded={open}
        aria-haspopup="true"
      >
        <Bell className="h-5 w-5" aria-hidden="true" />
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-magenta-500 px-1 text-[10px] font-bold text-white">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          ref={dropdownRef}
          role="menu"
          aria-label="Notifications"
          className="absolute right-0 top-full z-50 mt-2 w-[min(22rem,calc(100vw-2rem))] rounded-xl border border-cream-200 bg-white shadow-xl"
        >
          <div className="flex items-center justify-between border-b border-cream-200 px-4 py-3">
            <h3 className="text-sm font-bold text-ink-900">Notifications</h3>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={handleMarkAllRead}
                className="text-xs font-semibold text-royal-600 hover:text-royal-800"
              >
                Mark all read
              </button>
            )}
          </div>

          <div className="max-h-80 overflow-y-auto">
            {loading ? (
              <div className="px-4 py-8 text-center text-sm text-ink-500">Loading...</div>
            ) : notifications.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-ink-500">No notifications yet.</div>
            ) : (
              notifications.map((notification) => (
                <button
                  key={notification.id}
                  type="button"
                  onClick={() => {
                    handleMarkRead(notification.id)
                    if (notification.link) {
                      setOpen(false)
                      navigate(notification.link)
                    }
                  }}
                  className={cn(
                    'flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-cream-50',
                    !notification.read && 'bg-royal-50/50',
                  )}
                >
                  <div className="min-w-0 flex-1">
                    <p className={cn('text-sm font-semibold text-ink-900', !notification.read && 'font-bold')}>
                      {notification.title}
                    </p>
                    <p className="mt-0.5 line-clamp-2 text-xs text-ink-600">{notification.message}</p>
                    <p className="mt-1 text-[10px] text-ink-400">
                      {new Date(notification.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  {!notification.read && (
                    <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-magenta-500" aria-label="Unread" />
                  )}
                </button>
              ))
            )}
          </div>

          <div className="border-t border-cream-200 px-4 py-2.5">
            <button
              type="button"
              onClick={handleViewAll}
              className="w-full text-center text-xs font-semibold text-royal-600 hover:text-royal-800"
            >
              View all notifications
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
