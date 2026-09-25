import { useState } from 'react'
import type { FormEvent } from 'react'
import { KeyRound, Lock } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { PasswordField } from '@/components/dashboard/Field'
import { Spinner } from '@/components/dashboard/Loaders'
import { useToast } from '@/components/dashboard/Toast'
import { ProfileSectionHeading } from './ProfileSectionHeading'

interface PasswordForm {
  currentPassword: string
  newPassword: string
  confirmPassword: string
}

const emptyPasswordForm: PasswordForm = {
  currentPassword: '',
  newPassword: '',
  confirmPassword: '',
}

interface SecurityCardProps {
  /** Performs the password change; may throw an error carrying `fieldErrors`. */
  onChangePassword: (currentPassword: string, newPassword: string) => Promise<unknown>
}

/**
 * SECURITY card with the existing PRPS password-change rules. Validation
 * messages and backend contract are unchanged — only the presentation is
 * shared between the staff and parent profile pages.
 */
export function SecurityCard({ onChangePassword }: SecurityCardProps) {
  const { push } = useToast()
  const [form, setForm] = useState<PasswordForm>(emptyPasswordForm)
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
      await onChangePassword(form.currentPassword, form.newPassword)
      push('success', 'Password updated successfully.')
      setForm(emptyPasswordForm)
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
    <Card className="p-6">
      <ProfileSectionHeading
        tone="magenta"
        icon={<KeyRound className="h-4.5 w-4.5" aria-hidden="true" />}
        title="Security"
        description="Change your account password."
        trailing={
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-600/20">
            <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            Protected
          </span>
        }
      />
      <form onSubmit={handleSubmit} noValidate className="mt-5 space-y-4">
        <PasswordField
          label="Current password"
          name="currentPassword"
          autoComplete="current-password"
          value={form.currentPassword}
          onChange={(event) => set('currentPassword', event.target.value)}
          error={fieldErrors.currentPassword}
          toggleLabel="Show current password"
          required
        />
        <PasswordField
          label="New password"
          name="newPassword"
          autoComplete="new-password"
          value={form.newPassword}
          onChange={(event) => set('newPassword', event.target.value)}
          error={fieldErrors.newPassword}
          hint="At least 8 characters, including a letter and a number."
          toggleLabel="Show new password"
          required
        />
        <PasswordField
          label="Confirm new password"
          name="confirmPassword"
          autoComplete="new-password"
          value={form.confirmPassword}
          onChange={(event) => set('confirmPassword', event.target.value)}
          error={fieldErrors.confirmPassword}
          toggleLabel="Show confirm password"
          required
        />
        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          <p className="text-xs text-ink-500">Use a password you have not used before.</p>
          <Button type="submit" variant="primary" disabled={submitting}>
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
  )
}
