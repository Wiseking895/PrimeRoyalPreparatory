import { useCallback, useEffect, useState } from 'react'
import { api } from '@/lib/api'
import { useToast } from '@/components/dashboard/Toast'
import { PageHeader } from '@/components/dashboard/PageHeader'
import type { NotificationPreferenceView } from '@/types/portal'

/**
 * Notification preferences page — allows users to toggle their notification
 * channel preferences (email and in-app notifications).
 */
export function NotificationPreferencesPage() {
  const { push } = useToast()
  const [preferences, setPreferences] = useState<NotificationPreferenceView | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const fetchPreferences = useCallback(async () => {
    try {
      setLoading(true)
      const result = await api.getNotificationPreferences()
      setPreferences(result)
    } catch {
      push('error', 'Failed to load preferences.')
    } finally {
      setLoading(false)
    }
  }, [push])

  useEffect(() => { fetchPreferences() }, [fetchPreferences])

  const handleToggle = async (field: 'emailEnabled' | 'inAppEnabled', value: boolean) => {
    if (!preferences) return
    try {
      setSaving(true)
      const updated = await api.updateNotificationPreferences({ [field]: value })
      setPreferences(updated)
      push('success', 'Preferences updated.')
    } catch {
      push('error', 'Failed to update preferences.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Notification Preferences"
        description="Manage how you receive notifications"
      />

      {loading ? (
        <div className="rounded-2xl border border-cream-300/70 bg-white p-8 text-center shadow-sm">
          <p className="text-sm text-ink-500">Loading preferences...</p>
        </div>
      ) : !preferences ? (
        <div className="rounded-2xl border border-cream-300/70 bg-white p-8 text-center shadow-sm">
          <p className="text-sm text-ink-500">Failed to load preferences.</p>
        </div>
      ) : (
        <div className="rounded-2xl border border-cream-300/70 bg-white p-6 shadow-sm">
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-ink-900">In-App Notifications</p>
                <p className="text-xs text-ink-500">Receive notifications in your dashboard.</p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={preferences.inAppEnabled}
                disabled={saving}
                onClick={() => handleToggle('inAppEnabled', !preferences.inAppEnabled)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  preferences.inAppEnabled ? 'bg-royal-600' : 'bg-ink-300'
                }`}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  preferences.inAppEnabled ? 'translate-x-6' : 'translate-x-1'
                }`} />
              </button>
            </div>

            <div className="border-t border-cream-200" />

            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-ink-900">Email Notifications</p>
                <p className="text-xs text-ink-500">Receive notification summaries via email.</p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={preferences.emailEnabled}
                disabled={saving}
                onClick={() => handleToggle('emailEnabled', !preferences.emailEnabled)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  preferences.emailEnabled ? 'bg-royal-600' : 'bg-ink-300'
                }`}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  preferences.emailEnabled ? 'translate-x-6' : 'translate-x-1'
                }`} />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
