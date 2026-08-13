import { ShieldX } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/auth/AuthContext'
import { dashboardHomeFor } from '@/auth/dashboardHome'

export function ForbiddenPage() {
  const { user } = useAuth()
  const home = dashboardHomeFor(user)

  return (
    <div className="flex min-h-screen items-center justify-center bg-cream-100 px-4">
      <div className="w-full max-w-md rounded-2xl border border-cream-300/70 bg-white p-8 text-center shadow-[0_4px_24px_-8px_rgba(11,20,48,0.12)]">
        <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-red-100 text-red-600">
          <ShieldX className="h-8 w-8" aria-hidden="true" />
        </span>
        <h1 className="mt-5 text-xl font-extrabold text-ink-900">You don&apos;t have access</h1>
        <p className="mt-2 text-sm leading-relaxed text-ink-500">
          Your account does not have permission to view this area of the staff portal. If you
          believe this is a mistake, contact your school administrator.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <Link
            to={home}
            className="rounded-full bg-royal-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-royal-700"
          >
            Back to my dashboard
          </Link>
        </div>
      </div>
    </div>
  )
}