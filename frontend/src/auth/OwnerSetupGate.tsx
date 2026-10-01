import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '@/auth/AuthContext'
import { ProtectedRoute } from '@/auth/ProtectedRoute'
import { OWNER_ROLE } from '@/auth/roles'
import { FullPageLoader } from '@/components/dashboard/Loaders'
import { api } from '@/lib/api'

interface OwnerSetupGateProps {
  children: ReactNode
}

/**
 * Guard for the `/owner` area.
 *
 * Normally it is just `ProtectedRoute` with the OWNER role. Its extra job is
 * first-time onboarding: when nobody has created the school Owner yet, an
 * unauthenticated visitor who asks for `/owner/...` is sent to `/setup/owner`
 * instead of the sign-in page, because signing in cannot succeed before the
 * account exists. Once an Owner exists (or the check fails) the ordinary
 * `/login` behaviour applies unchanged.
 *
 * This is a navigation convenience only — `requireAuth` on the backend remains
 * the authority, and nothing here grants access to an unauthenticated visitor.
 */
export function OwnerSetupGate({ children }: OwnerSetupGateProps) {
  const { status } = useAuth()
  const [ownerExists, setOwnerExists] = useState<boolean | null>(null)

  useEffect(() => {
    if (status !== 'unauthenticated') return
    let active = true
    api
      .setupStatus()
      .then((result) => {
        if (active) setOwnerExists(result.ownerExists)
      })
      .catch(() => {
        // Fail closed towards the normal sign-in route rather than trapping
        // the visitor in a spinner or a loop.
        if (active) setOwnerExists(true)
      })
    return () => {
      active = false
    }
  }, [status])

  if (status === 'unauthenticated') {
    // Redirecting before the check answers would always bounce to /login on the
    // first frame, so wait for it.
    if (ownerExists === null) return <FullPageLoader />
    if (!ownerExists) return <Navigate to="/setup/owner" replace />
  }

  return <ProtectedRoute roles={[OWNER_ROLE]}>{children}</ProtectedRoute>
}
