import { useCallback, useEffect, useState } from 'react'
import { CheckCheck, Inbox } from 'lucide-react'
import { api } from '@/lib/api'
import { useToast } from '@/components/dashboard/Toast'
import { PageHeader } from '@/components/dashboard/PageHeader'
import { EmptyState } from '@/components/dashboard/States'
import type { NotificationView } from '@/types/portal'
import { cn } from '@/lib/cn'

/**
 * Full notifications page — lists all notifications for the current user
 * with mark-read and mark-all-read functionality.
 */
export function NotificationsPage() {
  const { push } = useToast()
  const [notifications, setNotifications] = useState<NotificationView[]>([])
  const [total, setTotal] = useState(0)
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(0)
  const pageSize = 20

  const fetchNotifications = useCallback(async () => {
    try {
      setLoading(true)
      const result = await api.listNotifications({ limit: pageSize, offset: page * pageSize })
      setNotifications(result.items)
      setTotal(result.total)
      setUnreadCount(result.unreadCount)
    } catch {
      push('error', 'Failed to load notifications.')
    } finally {
      setLoading(false)
    }
  }, [page, push])

  useEffect(() => {
    fetchNotifications()
  }, [fetchNotifications])

  const handleMarkRead = async (id: string) => {
    try {
      await api.markNotificationRead(id)
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read: true } : n)),
      )
      setUnreadCount((prev) => Math.max(0, prev - 1))
    } catch {
      push('error', 'Failed to mark notification as read.')
    }
  }

  const handleMarkAllRead = async () => {
    try {
      const result = await api.markAllNotificationsRead()
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
      setUnreadCount(0)
      push('success', `${result.updated} notification(s) marked as read.`)
    } catch {
      push('error', 'Failed to mark all as read.')
    }
  }

  const hasMore = (page + 1) * pageSize < total

  return (
    <div className="space-y-6">
      <PageHeader
        title="Notifications"
        description={`${unreadCount} unread notification${unreadCount !== 1 ? 's' : ''}`}
        actions={
          unreadCount > 0 ? (
            <button
              type="button"
              onClick={handleMarkAllRead}
              className="inline-flex items-center gap-2 rounded-xl bg-royal-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-royal-700"
            >
              <CheckCheck className="h-4 w-4" aria-hidden="true" />
              Mark all read
            </button>
          ) : undefined
        }
      />

      {loading ? (
        <div className="rounded-2xl border border-cream-300/70 bg-white p-8 text-center shadow-sm">
          <p className="text-sm text-ink-500">Loading notifications...</p>
        </div>
      ) : notifications.length === 0 ? (
        <EmptyState icon={<Inbox className="h-12 w-12" />} title="No notifications yet." />
      ) : (
        <div className="space-y-2">
          {notifications.map((notification) => (
            <div
              key={notification.id}
              className={cn(
                'flex items-start gap-4 rounded-2xl border border-cream-300/70 bg-white p-4 shadow-sm transition-colors hover:shadow-md',
                !notification.read && 'border-l-4 border-l-magenta-500 bg-royal-50/30',
              )}
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-3">
                  <h3 className={cn('text-sm font-semibold text-ink-900', !notification.read && 'font-bold')}>
                    {notification.title}
                  </h3>
                  <span className="shrink-0 rounded-full bg-cream-200 px-2 py-0.5 text-[10px] font-semibold text-ink-600">
                    {notification.type.replace(/_/g, ' ')}
                  </span>
                </div>
                <p className="mt-1 text-sm text-ink-600">{notification.message}</p>
                <p className="mt-2 text-xs text-ink-400">
                  {new Date(notification.createdAt).toLocaleString()}
                </p>
              </div>

              {!notification.read && (
                <button
                  type="button"
                  onClick={() => handleMarkRead(notification.id)}
                  className="shrink-0 rounded-lg border border-cream-300 px-3 py-1.5 text-xs font-semibold text-royal-600 transition-colors hover:bg-royal-50"
                >
                  Mark read
                </button>
              )}
            </div>
          ))}

          <div className="flex items-center justify-between pt-4">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              className="rounded-xl border border-cream-300 px-4 py-2 text-sm font-semibold text-ink-700 transition-colors hover:bg-cream-100 disabled:opacity-50"
            >
              Previous
            </button>
            <span className="text-xs text-ink-500">
              Page {page + 1} of {Math.max(1, Math.ceil(total / pageSize))}
            </span>
            <button
              type="button"
              onClick={() => setPage((p) => p + 1)}
              disabled={!hasMore}
              className="rounded-xl border border-cream-300 px-4 py-2 text-sm font-semibold text-ink-700 transition-colors hover:bg-cream-100 disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
