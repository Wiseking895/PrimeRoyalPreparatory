import { useState } from 'react'
import type { FormEvent } from 'react'
import { AlertCircle, Eye, EyeOff, Lock, LogIn, Mail, ShieldCheck } from 'lucide-react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useParentAuth } from '@/auth/ParentAuthContext'
import { Logo } from '@/components/common/Logo'
import { Spinner } from '@/components/dashboard/Loaders'
import { cn } from '@/lib/cn'

interface LocationState {
  from?: string
}

const fieldClasses =
  'h-12 w-full rounded-xl border border-cream-300 bg-white pl-11 pr-11 text-sm text-ink-900 outline-none transition-colors placeholder:text-ink-500/60 focus:border-gold-400'

export function ParentLoginPage() {
  const { status, profile, login } = useParentAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const state = location.state as LocationState | null

  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (status === 'authenticated' && profile) {
    return <Navigate to={state?.from ?? '/parent/dashboard'} replace />
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)

    if (!identifier.trim()) {
      setError('Enter the email address registered for your parent account.')
      return
    }
    if (!password) {
      setError('Enter your password.')
      return
    }

    setSubmitting(true)
    try {
      await login(identifier, password)
      navigate(state?.from ?? '/parent/dashboard', { replace: true })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Sign in failed. Please try again.'
      setError(message)
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
        <Link to="/" className="text-sm font-semibold text-royal-600 transition-colors hover:text-magenta-600">
          Back to website
        </Link>
      </header>

      <main className="flex flex-1 items-center justify-center px-4 pb-16">
        <div className="w-full max-w-md">
          <div className="rounded-2xl border border-cream-300/70 bg-white p-7 shadow-[0_4px_24px_-8px_rgba(11,20,48,0.12)] sm:p-8">
            <div className="flex items-center gap-4">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gold-400 text-royal-800">
                <ShieldCheck className="h-6 w-6" aria-hidden="true" />
              </span>
              <div>
                <h1 className="text-xl font-extrabold tracking-tight text-ink-900">PRPS Parent Portal</h1>
                <p className="mt-0.5 text-sm text-ink-500">Prime Royal Preparatory School</p>
              </div>
            </div>

            <form onSubmit={handleSubmit} noValidate className="mt-7 space-y-4">
              <div>
                <label htmlFor="parent-identifier" className="mb-1.5 block text-sm font-semibold text-ink-900">
                  Registered email address
                </label>
                <div className="relative">
                  <Mail
                    className="pointer-events-none absolute left-4 top-1/2 h-4.5 w-4.5 -translate-y-1/2 text-ink-500"
                    aria-hidden="true"
                  />
                  <input
                    id="parent-identifier"
                    type="email"
                    autoComplete="username"
                    value={identifier}
                    onChange={(event) => setIdentifier(event.target.value)}
                    placeholder="you@example.com"
                    className={fieldClasses}
                  />
                </div>
              </div>

              <div>
                <label htmlFor="parent-password" className="mb-1.5 block text-sm font-semibold text-ink-900">
                  Password
                </label>
                <div className="relative">
                  <Lock
                    className="pointer-events-none absolute left-4 top-1/2 h-4.5 w-4.5 -translate-y-1/2 text-ink-500"
                    aria-hidden="true"
                  />
                  <input
                    id="parent-password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="Enter your password"
                    className={fieldClasses}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((visible) => !visible)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-ink-500 transition-colors hover:text-ink-900"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4.5 w-4.5" aria-hidden="true" />
                    ) : (
                      <Eye className="h-4.5 w-4.5" aria-hidden="true" />
                    )}
                  </button>
                </div>
              </div>

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
                  'flex h-12 w-full items-center justify-center gap-2 rounded-full bg-gold-400 text-sm font-bold text-royal-800 transition-colors hover:bg-gold-500 disabled:cursor-not-allowed disabled:opacity-60',
                )}
              >
                {submitting ? (
                  <>
                    <Spinner className="h-4 w-4" /> Signing in…
                  </>
                ) : (
                  <>
                    <LogIn className="h-4.5 w-4.5" aria-hidden="true" /> Sign In
                  </>
                )}
              </button>
            </form>

            <p className="mt-5 text-center text-xs leading-relaxed text-ink-500">
              Parent accounts are issued by the school. Contact the school office if you have not
              received your login details.
            </p>
          </div>
        </div>
      </main>
    </div>
  )
}