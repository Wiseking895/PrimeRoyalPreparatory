import { KeyRound, Mail, Phone, UserRound } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useParentAuth } from '@/auth/ParentAuthContext'
import { PageHeader } from '@/components/dashboard/PageHeader'

export function ParentProfilePage() {
  const { profile } = useParentAuth()

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Parent Portal"
        title="My Profile"
        description="Your parent account details. Password changes happen through the link below."
      />

      <div className="max-w-2xl rounded-2xl border border-cream-300/70 bg-white p-6 shadow-[0_2px_16px_-8px_rgba(11,20,48,0.1)]">
        <dl className="grid gap-4 sm:grid-cols-2">
          <div>
            <dt className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-ink-500">
              <UserRound className="h-3.5 w-3.5" aria-hidden="true" /> Full name
            </dt>
            <dd className="mt-1 text-sm font-semibold text-ink-900">{profile?.fullName}</dd>
          </div>
          <div>
            <dt className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-ink-500">
              <Mail className="h-3.5 w-3.5" aria-hidden="true" /> Sign-in email
            </dt>
            <dd className="mt-1 text-sm font-semibold text-ink-900">{profile?.email}</dd>
          </div>
          <div>
            <dt className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-ink-500">
              <Phone className="h-3.5 w-3.5" aria-hidden="true" /> Phone
            </dt>
            <dd className="mt-1 text-sm font-semibold text-ink-900">{profile?.phone ?? '—'}</dd>
          </div>
          <div>
            <dt className="text-xs font-bold uppercase tracking-wider text-ink-500">Status</dt>
            <dd className="mt-1 text-sm font-semibold text-ink-900">
              {profile?.status === 'ACTIVE' ? 'Active' : 'Inactive'}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-bold uppercase tracking-wider text-ink-500">Linked children</dt>
            <dd className="mt-1 text-sm font-semibold text-ink-900">{profile?.linkedPupilCount}</dd>
          </div>
        </dl>

        <div className="mt-6 border-t border-cream-200 pt-5">
          <Link
            to="/parent/change-password"
            className="inline-flex items-center gap-2 rounded-full bg-royal-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-royal-700"
          >
            <KeyRound className="h-4 w-4" aria-hidden="true" />
            Change password
          </Link>
        </div>
      </div>
    </div>
  )
}