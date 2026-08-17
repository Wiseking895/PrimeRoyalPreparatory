import { useCallback, useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { AlertCircle, ArrowRight, CheckCircle2, Crown, ShieldCheck } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { Logo } from '@/components/common/Logo'
import { TextField } from '@/components/dashboard/Field'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/dashboard/Loaders'
import { api } from '@/lib/api'
import { cn } from '@/lib/cn'

interface SetupForm {
  fullName: string
  email: string
  phone: string
  password: string
  confirmPassword: string
}

const emptyForm: SetupForm = {
  fullName: '',
  email: '',
  phone: '',
  password: '',
  confirmPassword: '',
}

export function OwnerSetupPage() {
  const navigate = useNavigate()

  const [statusLoading, setStatusLoading] = useState(true)
  const [ownerExists, setOwnerExists] = useState<boolean | null>(null)
  const [statusError, setStatusError] = useState<string | null>(null)

  const [form, setForm] = useState<SetupForm>(emptyForm)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [completed, setCompleted] = useState(false)

  const checkStatus = useCallback(async () => {
    setStatusLoading(true)
    setStatusError(null)
    try {
      const status = await api.setupStatus()
      setOwnerExists(status.ownerExists)
    } catch (err) {
      setStatusError(err instanceof Error ? err.message : 'Could not check the setup status.')
    } finally {
      setStatusLoading(false)
    }
  }, [])

  useEffect(() => {
    void checkStatus()
  }, [checkStatus])

  const set = (field: keyof SetupForm, value: string) => {
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
    setSubmitError(null)
    setFieldErrors({})
    const errors: Record<string, string> = {}
    if (form.fullName.trim().length < 3) errors.fullName = 'Full name must be at least 3 characters.'
    if (!/^\S+@\S+\.\S+$/.test(form.email.trim())) errors.email = 'Enter a valid email address.'
    if (form.password.length < 8) errors.password = 'Password must be at least 8 characters.'
    if (form.password !== form.confirmPassword) errors.confirmPassword = 'Passwords do not match.'
    if (
      form.password.length >= 8 &&
      ((form.password.match(/[A-Za-z]/) && !form.password.match(/[0-9]/)) ||
        (!form.password.match(/[A-Za-z]/) && form.password.match(/[0-9]/)))
    ) {
      errors.password = 'Password must include letters and numbers.'
    }
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors)
      return
    }

    setSubmitting(true)
    try {
      await api.createOwner({
        fullName: form.fullName,
        email: form.email,
        phone: form.phone || undefined,
        password: form.password,
        confirmPassword: form.confirmPassword,
      })
      setCompleted(true)
    } catch (err) {
      if (err instanceof Error) {
        const apiError = err as { fieldErrors?: Record<string, string> }
        if (apiError.fieldErrors && Object.keys(apiError.fieldErrors).length > 0) {
          setFieldErrors(apiError.fieldErrors)
        } else {
          setSubmitError(err.message)
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
        <Link
          to="/"
          className="text-sm font-semibold text-royal-600 transition-colors hover:text-magenta-600"
        >
          Back to website
        </Link>
      </header>

      <main className="flex flex-1 items-center justify-center px-4 pb-16">
        <div className="w-full max-w-md">
          <div className="rounded-2xl border border-cream-300/70 bg-white p-7 shadow-[0_4px_24px_-8px_rgba(11,20,48,0.12)] sm:p-8">
            <div className="flex items-center gap-4">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-royal-600 text-white">
                <Crown className="h-6 w-6" aria-hidden="true" />
              </span>
              <div>
                <h1 className="text-xl font-extrabold tracking-tight text-ink-900">Set up your school</h1>
                <p className="mt-0.5 text-sm text-ink-500">Prime Royal Preparatory School</p>
              </div>
            </div>

            {statusLoading ? (
              <div className="mt-8 flex flex-col items-center gap-3 py-10 text-royal-700" role="status" aria-live="polite">
                <Spinner className="h-7 w-7" />
                <span className="text-sm font-semibold">Checking setup status…</span>
              </div>
            ) : statusError ? (
              <div className="mt-8 space-y-4 text-center">
                <p className="flex items-start gap-2 rounded-xl bg-red-50 p-3 text-sm leading-relaxed text-red-700" role="alert">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                  {statusError}
                </p>
                <Button variant="soft" onClick={() => void checkStatus()}>
                  Try again
                </Button>
              </div>
            ) : ownerExists ? (
              <div className="mt-8 text-center">
                <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-600">
                  <CheckCircle2 className="h-8 w-8" aria-hidden="true" />
                </span>
                <h2 className="mt-5 text-lg font-bold text-ink-900">Setup is already complete</h2>
                <p className="mt-2 text-sm leading-relaxed text-ink-500">
                  An Owner account already exists. Sign in with your credentials to enter the staff portal.
                </p>
                <div className="mt-6">
                  <Button to="/login" className="w-full">
                    Go to Staff Sign In
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </Button>
                </div>
              </div>
            ) : completed ? (
              <div className="mt-8 text-center">
                <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-600">
                  <CheckCircle2 className="h-8 w-8" aria-hidden="true" />
                </span>
                <h2 className="mt-5 text-lg font-bold text-ink-900">School set up successfully</h2>
                <p className="mt-2 text-sm leading-relaxed text-ink-500">
                  Your Owner account is ready. Sign in to open the staff portal.
                </p>
                <div className="mt-6">
                  <Button onClick={() => navigate('/login', { replace: true })} className="w-full">
                    Go to Staff Sign In
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </Button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit} noValidate className="mt-7 space-y-4">
                <TextField
                  label="Full name"
                  name="fullName"
                  autoComplete="name"
                  value={form.fullName}
                  onChange={(event) => set('fullName', event.target.value)}
                  error={fieldErrors.fullName}
                  required
                />
                <TextField
                  label="Email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  value={form.email}
                  onChange={(event) => set('email', event.target.value)}
                  error={fieldErrors.email}
                  required
                />
                <TextField
                  label="Phone (optional)"
                  name="phone"
                  autoComplete="tel"
                  value={form.phone}
                  onChange={(event) => set('phone', event.target.value)}
                  error={fieldErrors.phone}
                />
                <TextField
                  label="Password"
                  name="password"
                  type="password"
                  autoComplete="new-password"
                  value={form.password}
                  onChange={(event) => set('password', event.target.value)}
                  error={fieldErrors.password}
                  hint="At least 8 characters, including a letter and a number."
                  required
                />
                <TextField
                  label="Confirm password"
                  name="confirmPassword"
                  type="password"
                  autoComplete="new-password"
                  value={form.confirmPassword}
                  onChange={(event) => set('confirmPassword', event.target.value)}
                  error={fieldErrors.confirmPassword}
                  required
                />

                {submitError ? (
                  <p
                    className="flex items-start gap-2 rounded-xl bg-red-50 p-3 text-sm leading-relaxed text-red-700"
                    role="alert"
                  >
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                    {submitError}
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
                      <Spinner className="h-4 w-4" /> Creating account…
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="h-4.5 w-4.5" aria-hidden="true" /> Create Owner account
                    </>
                  )}
                </button>

                <p className="text-center text-xs leading-relaxed text-ink-500">
                  This one-time step creates the Owner — the school&apos;s root administrative account.
                </p>
              </form>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}