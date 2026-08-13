import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/auth/AuthContext'
import { ForbiddenPage } from '@/pages/portal/ForbiddenPage'
import { FullPageLoader } from '@/components/dashboard/Loaders'

interface ProtectedRouteProps {
  /** If provided, the user must hold at least one of these roles. */
  roles?: string[]
  children: ReactNode
}

/**
 * Route guard. Unauthenticated visitors are redirected to `/login` (remembering
 * where they came from); authenticated users lacking a required role receive a
 * clear 403-style screen instead of silent access. The backend remains the
 * authority — this is a UI convenience, not a security boundary.
 */
export function ProtectedRoute({ roles, children }: ProtectedRouteProps) {
  const { status, user } = useAuth()
  const location = useLocation()

  if (status === 'loading') {
    return <FullPageLoader />
  }

  if (status === 'unauthenticated') {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }

  if (roles && roles.length > 0 && !roles.some((role) => user?.roles.includes(role))) {
    return <ForbiddenPage />
  }

  return <>{children}</>
}
