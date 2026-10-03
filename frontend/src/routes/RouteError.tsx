import { useEffect } from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'
import { useRouteError } from 'react-router-dom'
import { useAuth } from '@/auth/AuthContext'
import { dashboardHomeFor } from '@/auth/dashboardHome'
import { getParentToken } from '@/auth/parentStorage'
import { getStoredUser, getToken } from '@/auth/storage'
import { Button } from '@/components/ui/Button'

/**
 * Route-level error boundary for every top-level route. React Router's default
 * boundary renders the raw error + stack trace in an un-wrappable `<pre>`,
 * which overflows horizontally on phones. This shows a branded, mobile-safe
 * screen instead and preserves the technical detail in the console.
 */
export function RouteError() {
  const error = useRouteError()
  const { user } = useAuth()

  useEffect(() => {
    console.error('[PRPS] Unhandled route error:', error)
  }, [error])

  // Resolve a safe destination without touching auth behaviour: prefer the
  // live session, fall back to the stored staff/parent profile, else public home.
  const staffUser = user ?? getStoredUser()
  const safeTo = staffUser
    ? dashboardHomeFor(staffUser)
    : getParentToken()
      ? '/parent/dashboard'
      : '/'
  const signedIn = Boolean(staffUser) || Boolean(getParentToken() || getToken())

  return (
    <main className="flex min-h-screen items-center justify-center bg-cream-100 px-4 py-12">
      <div className="w-full max-w-md rounded-2xl border border-cream-300/70 bg-white p-8 text-center shadow-[0_4px_24px_-8px_rgba(11,20,48,0.12)]">
        <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-magenta-50 text-magenta-600">
          <AlertTriangle className="h-8 w-8" aria-hidden="true" />
        </span>
        <h1 className="mt-5 text-xl font-extrabold text-ink-900">Something went wrong</h1>
        <p className="mt-2 break-words text-sm leading-relaxed text-ink-500">
          We hit an unexpected problem while loading this page. The technical details have been
          logged so the school administrator can look into it. You can try again, or head back to
          a page that works.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <Button onClick={() => window.location.reload()}>
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            Try again
          </Button>
          <Button variant="soft" to={safeTo}>
            {signedIn ? 'Back to my dashboard' : 'Back to homepage'}
          </Button>
        </div>
      </div>
    </main>
  )
}
