import { useState } from 'react'
import type { FormEvent } from 'react'
import { AlertCircle, KeyRound, ShieldCheck } from 'lucide-react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '@/auth/AuthContext'
import { dashboardHomeFor } from '@/auth/dashboardHome'
import { Logo } from '@/components/common/Logo'
import { Spinner } from '@/components/dashboard/Loaders'
import { TextField } from '@/components/dashboard/Field'
import { cn } from '@/lib/cn'
import { api } from '@/lib/api'

interface ChangeForm {
  newPassword: string
  confirmPassword: string
}

const emptyForm: ChangeForm = { newPassword: '', confirmPassword: '' }

export function ChangePasswordPage() {
  const { user, status, refreshUser } = useAuth()
  const navigate = useNavigate()

  const [form, setForm] = useState<ChangeForm>(emptyForm)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (status === 'unauthenticated') {
    return <Navigate to="/login" replace />
  }

  if (status === 'authenticated' && user && !user.mustChangePassword) {
    return <Navigate to={dashboardHomeFor(user)} replace />
  }

  const set = (field: keyof ChangeForm, value: string) => {
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
    setError(null)
    setFieldErrors({})
    const errors: Record<string, string> = {}
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
      await api.firstPasswordChange(form.newPassword, form.confirmPassword)
      const updated = await refreshUser()
      navigate(dashboardHomeFor(updated), { replace: true })
    } catch (err) {
      if (err instanceof Error) {
        const apiError = err as { fieldErrors?: Record<string, string> }
        if (apiError.fieldErrors && Object.keys(apiError.fieldErrors).length > 0) {
          setFieldErrors(apiError.fieldErrors)
        } else {
          setError(err.message)
        }
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-cream-100">
      <header className="flex items-center justify-between px-5 py-5">
        <Link to="/" aria-label="PRPS — go to homepage" className="inline-flex">
          <Logo />
        </Link>
        <span className="text-sm font-semibold text-ink-500">Staff Portal</span>
      </header>

      <main className="flex flex-1 items-center justify-center px-4 pb-16">
        <div className="w-full max-w-md">
          <div className="rounded-2xl border border-cream-300/70 bg-white p-7 shadow-[0_4px_24px_-8px_rgba(11,20,48,0.12)] sm:p-8">
            <div className="flex items-center gap-4">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-magenta-500 text-white">
                <KeyRound className="h-6 w-6" aria-hidden="true" />
              </span>
              <div>
                <h1 className="text-xl font-extrabold tracking-tight text-ink-900">Set a new password</h1>
                <p className="mt-0.5 text-sm text-ink-500">Prime Royal Preparatory School</p>
              </div>
            </div>

            <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-3.5 text-sm leading-relaxed text-amber-800">
              Your account was created with a temporary password. Please create a new password before
              continuing.
            </div>

            <form onSubmit={handleSubmit} noValidate className="mt-5 space-y-4">
              <TextField
                label="New Password"
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
                label="Confirm New Password"
                name="confirmPassword"
                type="password"
                autoComplete="new-password"
                value={form.confirmPassword}
                onChange={(event) => set('confirmPassword', event.target.value)}
                error={fieldErrors.confirmPassword}
                required
              />

              {error ? (
                <p
                  className="flex items-start gap-2 rounded-xl bg-red-50 p-3 text-sm leading-relaxed text-red-700"
                  role="alert"
                >
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                  {error}
                </p>
              ) : null}

              <button
                type="submit"
                disabled={submitting}
                className={cn(
                  'flex h-12 w-full items-center justify-center gap-2 rounded-full bg-magenta-500 text-sm font-bold text-white transition-colors hover:bg-magenta-600 disabled:cursor-not-allowed disabled:opacity-60',
                )}
              >
                {submitting ? (
                  <>
                    <Spinner className="h-4 w-4" /> Saving…
                  </>
                ) : (
                  <>
                    <ShieldCheck className="h-4.5 w-4.5" aria-hidden="true" /> Change Password
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      </main>
    </div>
  )
}