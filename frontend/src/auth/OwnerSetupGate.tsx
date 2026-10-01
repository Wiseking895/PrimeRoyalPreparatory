import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { AlertCircle } from 'lucide-react'
import { useAuth } from '@/auth/AuthContext'
import { ProtectedRoute } from '@/auth/ProtectedRoute'
import { OWNER_ROLE } from '@/auth/roles'
import { FullPageLoader } from '@/components/dashboard/Loaders'
import { Button } from '@/components/ui/Button'
import { api } from '@/lib/api'

interface OwnerSetupGateProps {
  children: ReactNode
}

/**
 * Branded dead-end shown when `GET /api/setup/status` cannot be answered.
 *
 * Falling back to `/login` here would look exactly like the bug this gate
 * exists to fix ("`/owner` always sends me to the login page"), so the failure
 * is surfaced instead, with an explicit retry and an explicit way to sign in.
 * Nothing is granted either way — the backend still decides who may enter.
 */
function SetupStatusError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-cream-100 px-4 py-16">
      <div className="w-full max-w-md rounded-2xl border border-cream-300/70 bg-white p-7 text-center shadow-[0_4px_24px_-8px_rgba(11,20,48,0.12)] sm:p-8">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-red-100 text-red-600">
          <AlertCircle className="h-7 w-7" aria-hidden="true" />
        </span>
        <h1 className="mt-5 text-lg font-bold text-ink-900">We could not reach the server</h1>
        <p className="mt-2 text-sm leading-relaxed text-ink-500">
          The Owner sign-in status could not be checked. Check your connection and try again.
        </p>
        <div className="mt-6 flex flex-col gap-3">
          <Button onClick={onRetry} className="w-full">
            Try again
          </Button>
          <Button to="/login" variant="soft" className="w-full">
            Go to staff sign in
          </Button>
        </div>
      </div>
    </div>
  )
}

/**
 * Guard for the `/owner` area.
 *
 * Normally it is just `ProtectedRoute` with the OWNER role. Its extra job is
 * first-time onboarding: before anyone can sign in, the school Owner has to
 * exist, so an unauthenticated visit to `/owner/...` first asks the backend
 * whether the ACTUAL school Owner has been created yet.
 *
 *   - no school Owner  -> `/setup/owner` (the public first-time sign-up)
 *   - Owner exists     -> the ordinary `/login` behaviour, unchanged
 *
 * `GET /api/setup/status` never counts the permanent developer account, so the
 * technical OWNER role held by `developer@prps.local` cannot close the
 * onboarding flow. This is a navigation convenience only — `requireAuth` on the
 * backend remains the authority, and nothing here grants an unauthenticated
 * visitor access to the Owner dashboard.
 */
export function OwnerSetupGate({ children }: OwnerSetupGateProps) {
  const { status } = useAuth()
  const [ownerExists, setOwnerExists] = useState<boolean | null>(null)
  const [statusFailed, setStatusFailed] = useState(false)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    if (status !== 'unauthenticated') return
    let active = true
    setStatusFailed(false)
    setOwnerExists(null)
    api
      .setupStatus()
      .then((result) => {
        if (active) setOwnerExists(result.ownerExists)
      })
      .catch(() => {
        // Surface the failure instead of silently bouncing to /login, which
        // would be indistinguishable from the reported "`/owner` -> /login"
        // bug. Retrying re-runs this check; nothing is granted without it.
        if (active) setStatusFailed(true)
      })
    return () => {
      active = false
    }
  }, [status, attempt])

  if (status === 'unauthenticated') {
    if (statusFailed) {
      return <SetupStatusError onRetry={() => setAttempt((value) => value + 1)} />
    }
    // Redirecting before the check answers would always bounce to /login on the
    // first frame, so wait for it.
    if (ownerExists === null) return <FullPageLoader />
    if (!ownerExists) return <Navigate to="/setup/owner" replace />
  }

  return <ProtectedRoute roles={[OWNER_ROLE]}>{children}</ProtectedRoute>
}
