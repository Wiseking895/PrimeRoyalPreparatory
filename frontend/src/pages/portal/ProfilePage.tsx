import { useState } from 'react'
import type { FormEvent } from 'react'
import { KeyRound, Lock, ShieldCheck, UserRound } from 'lucide-react'
import { useAuth } from '@/auth/AuthContext'
import { PageHeader } from '@/components/dashboard/PageHeader'
import { Card } from '@/components/ui/Card'
import { Avatar } from '@/components/dashboard/Avatar'
import { StatusBadge, Badge } from '@/components/dashboard/Badge'
import { TextField } from '@/components/dashboard/Field'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/dashboard/Loaders'
import { useToast } from '@/components/dashboard/Toast'
import { api } from '@/lib/api'

interface PasswordForm {
  currentPassword: string
  newPassword: string
  confirmPassword: string
}

export function ProfilePage() {
  const { user } = useAuth()
  const { push } = useToast()

  const [form, setForm] = useState<PasswordForm>({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  })
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)

  const set = (field: keyof PasswordForm, value: string) => {
    setForm((current) => ({ ...current, [field]: value }))
    setFieldErrors((current) => {
      if (!current[field]) return current
      const next = { ...current }
      delete next[field]
      return next
    })
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setFieldErrors({})
    const errors: Record<string, string> = {}
    if (!form.currentPassword) errors.currentPassword = 'Enter your current password.'
    if (form.newPassword.length < 8) errors.newPassword = 'Password must be at least 8 characters.'
    if (form.newPassword !== form.confirmPassword) errors.confirmPassword = 'Passwords do not match.'
    if (
      form.newPassword.length >= 8 &&
      ((form.newPassword.match(/[A-Za-z]/) && !form.newPassword.match(/[0-9]/)) ||
        (!form.newPassword.match(/[A-Za-z]/) && form.newPassword.match(/[0-9]/)))
    ) {
      errors.newPassword = 'Password must include letters and numbers.'
    }
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors)
      return
    }

    setSubmitting(true)
    try {
      await api.changePassword(form.currentPassword, form.newPassword)
      push('success', 'Password updated successfully.')
      setForm({ currentPassword: '', newPassword: '', confirmPassword: '' })
    } catch (err) {
      if (err instanceof Error) {
        const apiError = err as { fieldErrors?: Record<string, string> }
        if (apiError.fieldErrors && Object.keys(apiError.fieldErrors).length > 0) {
          setFieldErrors(apiError.fieldErrors)
        } else {
          push('error', err.message)
        }
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="My Profile"
        title="Profile"
        description="Your account details and security settings."
      />

      <Card className="p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <Avatar name={user?.fullName ?? 'User'} size="lg" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-lg font-bold text-ink-900">{user?.fullName}</p>
              <StatusBadge status={user?.status ?? 'ACTIVE'} />
            </div>
            <p className="mt-0.5 text-sm text-ink-500">
              {user?.staffId ?? 'No staff ID'} · {user?.email}
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {user?.roles.map((role) => (
                <Badge key={role} tone="royal">
                  <UserRound className="h-3.5 w-3.5" aria-hidden="true" />
                  {role}
                </Badge>
              ))}
            </div>
          </div>
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Permissions summary */}
        <Card className="p-6">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-royal-500" aria-hidden="true" />
            <h2 className="text-sm font-bold uppercase tracking-wider text-ink-500">Your Permissions</h2>
          </div>
          <div className="mt-4 flex flex-wrap gap-1.5">
            {user && user.permissions.length > 0 ? (
              user.permissions.map((permission) => (
                <span
                  key={permission}
                  className="rounded-full bg-cream-100 px-2.5 py-1 text-xs font-medium text-ink-700 ring-1 ring-inset ring-cream-300"
                >
                  {permission}
                </span>
              ))
            ) : (
              <p className="text-sm text-ink-500">This account has no assigned permissions.</p>
            )}
          </div>
        </Card>

        {/* Change password */}
        <Card className="p-6">
          <div className="flex items-center gap-2">
            <KeyRound className="h-5 w-5 text-royal-500" aria-hidden="true" />
            <h2 className="text-sm font-bold uppercase tracking-wider text-ink-500">Change Password</h2>
          </div>
          <form onSubmit={handleSubmit} noValidate className="mt-4 space-y-4">
            <TextField
              label="Current password"
              name="currentPassword"
              type="password"
              autoComplete="current-password"
              value={form.currentPassword}
              onChange={(event) => set('currentPassword', event.target.value)}
              error={fieldErrors.currentPassword}
              required
            />
            <TextField
              label="New password"
              name="newPassword"
              type="password"
              autoComplete="new-password"
              value={form.newPassword}
              onChange={(event) => set('newPassword', event.target.value)}
              error={fieldErrors.newPassword}
              hint="At least 8 characters, including a letter and a number."
              required
            />
            <TextField
              label="Confirm new password"
              name="confirmPassword"
              type="password"
              autoComplete="new-password"
              value={form.confirmPassword}
              onChange={(event) => set('confirmPassword', event.target.value)}
              error={fieldErrors.confirmPassword}
              required
            />
            <div className="flex justify-end">
              <Button type="submit" disabled={submitting}>
                {submitting ? (
                  <Spinner className="h-4 w-4" />
                ) : (
                  <Lock className="h-4 w-4" aria-hidden="true" />
                )}
                Update password
              </Button>
            </div>
          </form>
        </Card>
      </div>
    </div>
  )
}
