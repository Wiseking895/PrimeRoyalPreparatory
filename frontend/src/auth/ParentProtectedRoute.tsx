import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useParentAuth } from '@/auth/ParentAuthContext'
import { FullPageLoader } from '@/components/dashboard/Loaders'

interface ParentProtectedRouteProps {
  children: ReactNode
}

/** Pages that stay reachable while the account still carries mustChangePassword. */
const FIRST_LOGIN_ALLOWLIST = new Set(['/parent/change-password', '/parent/me'])

/**
 * Parent Portal route guard. Unauthenticated parents are sent to `/parent/login`;
 * parents who signed in with a temporary password are held on the password set-up
 * page until they create a real one (mirrors the backend require-parent-auth gate).
 */
export function ParentProtectedRoute({ children }: ParentProtectedRouteProps) {
  const { status, profile } = useParentAuth()
  const location = useLocation()

  if (status === 'loading') {
    return <FullPageLoader />
  }

  if (status === 'unauthenticated') {
    return <Navigate to="/parent/login" replace state={{ from: location.pathname }} />
  }

  if (profile?.mustChangePassword && !FIRST_LOGIN_ALLOWLIST.has(location.pathname)) {
    return <Navigate to="/parent/change-password" replace />
  }

  return <>{children}</>
}