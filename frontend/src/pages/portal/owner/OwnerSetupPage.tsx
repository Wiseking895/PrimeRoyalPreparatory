import { useCallback, useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { AlertCircle, ArrowRight, CheckCircle2, ChevronLeft, Crown, Mail, ShieldCheck } from 'lucide-react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '@/auth/AuthContext'
import { clearSession, saveToken } from '@/auth/storage'
import { Logo } from '@/components/common/Logo'
import { TextField } from '@/components/dashboard/Field'
import { Spinner } from '@/components/dashboard/Loaders'
import { Button } from '@/components/ui/Button'
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

/** Human-readable reasons the backend can send back after a failed callback. */
const GOOGLE_ERROR_MESSAGES: Record<string, string> = {
  state: 'That Google sign-in expired or was interrupted. Please try again.',
  denied: 'Google sign-in was cancelled. You can continue with email instead.',
  profile: 'Your Google account could not be used here. Try signing up with email instead.',
  unavailable: 'Sign in with Google is temporarily unavailable. Please try again or use email.',
}

function GoogleGlyph() {
  return (
    <svg viewBox="0 0 48 48" className="h-5 w-5" aria-hidden="true" focusable="false">
      <path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <path
        fill="#FBBC05"
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
    </svg>
  )
}

function StatusBlock({ label }: { label: string }) {
  return (
    <div className="mt-8 flex flex-col items-center gap-3 py-10 text-royal-700" role="status" aria-live="polite">
      <Spinner className="h-7 w-7" />
      <span className="text-sm font-semibold">{label}</span>
    </div>
  )
}

export function OwnerSetupPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const { setSession } = useAuth()

  const [statusLoading, setStatusLoading] = useState(true)
  const [ownerExists, setOwnerExists] = useState<boolean | null>(null)
  const [googleEnabled, setGoogleEnabled] = useState(false)
  const [statusError, setStatusError] = useState<string | null>(null)

  const [mode, setMode] = useState<'choose' | 'email'>('choose')
  const [form, setForm] = useState<SetupForm>(emptyForm)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [completed, setCompleted] = useState(false)

  // `#token=` is how Google sign-in hands the new session back: fragments are
  // never sent to a server, so the token only ever exists in this browser.
  const tokenInHash = location.hash.startsWith('#token=') ? location.hash.slice('#token='.length) : ''
  const [tokenState, setTokenState] = useState<'idle' | 'accepting' | 'failed'>(
    tokenInHash ? 'accepting' : 'idle',
  )

  const checkStatus = useCallback(async () => {
    setStatusLoading(true)
    setStatusError(null)
    try {
      const status = await api.setupStatus()
      setOwnerExists(status.ownerExists)
      setGoogleEnabled(status.googleOAuthEnabled === true)
    } catch (err) {
      setStatusError(err instanceof Error ? err.message : 'Could not check the setup status.')
    } finally {
      setStatusLoading(false)
    }
  }, [])

  useEffect(() => {
    void checkStatus()
  }, [checkStatus])

  useEffect(() => {
    if (tokenState !== 'accepting') return
    const token = decodeURIComponent(tokenInHash)
    if (!token) {
      setTokenState('failed')
      navigate('/setup/owner', { replace: true })
      return
    }

    let active = true
    saveToken(token)
    api
      .me()
      .then((profile) => {
        if (!active) return
        setSession(token, profile)
        navigate('/owner/dashboard', { replace: true })
      })
      .catch(() => {
        if (!active) return
        clearSession()
        setTokenState('failed')
        setSubmitError('Your Google sign-in could not be completed. Please try again.')
        navigate('/setup/owner', { replace: true })
      })

    return () => {
      active = false
    }
  }, [tokenState, tokenInHash, navigate, setSession])

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
      const result = await api.createOwner({
        fullName: form.fullName,
        email: form.email,
        phone: form.phone || undefined,
        password: form.password,
        confirmPassword: form.confirmPassword,
      })
      // The account exists and is already signed in — the next click simply
      // walks into the Owner dashboard.
      setSession(result.token, result.user)
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

  const providerError = searchParams.get('error')
  const errorMessage =
    submitError ?? (providerError ? (GOOGLE_ERROR_MESSAGES[providerError] ?? GOOGLE_ERROR_MESSAGES.unavailable) : null)
  const showChoice = mode === 'choose' && googleEnabled && !completed && !ownerExists

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
                <h1 className="text-xl font-extrabold tracking-tight text-ink-900">
                  {completed ? 'Your school is ready' : 'Create your Owner account'}
                </h1>
                <p className="mt-0.5 text-sm text-ink-500">Prime Royal Preparatory School</p>
              </div>
            </div>

            {tokenState === 'accepting' ? (
              <StatusBlock label="Completing Google sign-in…" />
            ) : statusLoading ? (
              <StatusBlock label="Checking setup status…" />
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
                  Your Owner account has been created and you are signed in.
                </p>
                <div className="mt-6">
                  <Button onClick={() => navigate('/owner/dashboard', { replace: true })} className="w-full">
                    Continue to Owner Dashboard
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </Button>
                </div>
              </div>
            ) : showChoice ? (
              <div className="mt-7 space-y-5">
                <p className="text-sm leading-relaxed text-ink-500">
                  This one-time step creates the Owner — the school&apos;s root administrative account that manages
                  staff, pupils and fees.
                </p>

                {errorMessage ? (
                  <p
                    className="flex items-start gap-2 rounded-xl bg-red-50 p-3 text-sm leading-relaxed text-red-700"
                    role="alert"
                  >
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                    {errorMessage}
                  </p>
                ) : null}

                <a
                  href={api.googleOAuthStartUrl()}
                  className="flex h-12 w-full items-center justify-center gap-3 rounded-full border border-cream-300 bg-white text-sm font-bold text-ink-900 shadow-sm transition-colors hover:bg-cream-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-royal-600 focus-visible:ring-offset-2"
                >
                  <GoogleGlyph />
                  Continue with Google
                </a>

                <div className="flex items-center gap-3" aria-hidden="true">
                  <span className="h-px flex-1 bg-cream-300" />
                  <span className="text-xs font-semibold uppercase tracking-wider text-ink-400">or</span>
                  <span className="h-px flex-1 bg-cream-300" />
                </div>

                <button
                  type="button"
                  onClick={() => setMode('email')}
                  className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-magenta-500 text-sm font-bold text-white transition-colors hover:bg-magenta-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-magenta-500 focus-visible:ring-offset-2"
                >
                  <Mail className="h-4.5 w-4.5" aria-hidden="true" />
                  Continue with Email
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} noValidate className="mt-7 space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-ink-900">Sign up with email</p>
                  {googleEnabled ? (
                    <button
                      type="button"
                      onClick={() => setMode('choose')}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-royal-600 transition-colors hover:text-magenta-600"
                    >
                      <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" />
                      Back
                    </button>
                  ) : null}
                </div>

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

                {errorMessage ? (
                  <p
                    className="flex items-start gap-2 rounded-xl bg-red-50 p-3 text-sm leading-relaxed text-red-700"
                    role="alert"
                  >
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                    {errorMessage}
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
