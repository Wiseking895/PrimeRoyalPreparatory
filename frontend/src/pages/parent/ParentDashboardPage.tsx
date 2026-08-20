import { useEffect, useState } from 'react'
import { Baby, FileText, Users } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useParentAuth } from '@/auth/ParentAuthContext'
import { PageHeader } from '@/components/dashboard/PageHeader'
import { StatCard } from '@/components/dashboard/StatCard'
import { CardSkeleton } from '@/components/dashboard/Loaders'
import { EmptyState } from '@/components/dashboard/States'
import { api } from '@/lib/api'
import type { ParentChildView } from '@/types/portal'

export function ParentDashboardPage() {
  const { profile } = useParentAuth()
  const [children, setChildren] = useState<ParentChildView[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    api
      .myChildren()
      .then((result) => {
        if (active) setChildren(result)
      })
      .catch((err) => {
        if (active) setError(err instanceof Error ? err.message : 'Failed to load your children.')
      })
    return () => {
      active = false
    }
  }, [])

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Parent Portal"
        title={`Welcome, ${profile?.fullName ?? 'Parent'}`}
        description="View your children's profile, fee account and academic reports."
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard
          label="Linked children"
          value={children?.length ?? profile?.linkedPupilCount ?? 0}
          hint="Guardians you are connected to"
          icon={<Users className="h-5 w-5" aria-hidden="true" />}
          tone="royal"
        />
        <StatCard
          label="Reports available"
          value={children?.filter((child) => child.status === 'ACTIVE').length ?? 0}
          hint="Active children you can view"
          icon={<FileText className="h-5 w-5" aria-hidden="true" />}
          tone="gold"
        />
        <StatCard
          label="Primary contact"
          value={profile?.linkedPupilCount ?? 0}
          hint="Your account is active"
          icon={<Baby className="h-5 w-5" aria-hidden="true" />}
          tone="magenta"
        />
      </div>

      <section>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-extrabold tracking-tight text-ink-900">My Children</h2>
          <Link
            to="/parent/children"
            className="rounded-full bg-royal-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-royal-700"
          >
            View all
          </Link>
        </div>

        {children === null && !error ? (
          <CardSkeleton />
        ) : error ? (
          <p className="rounded-2xl border border-red-100 bg-red-50 p-4 text-sm text-red-700">{error}</p>
        ) : children && children.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {children.map((child) => (
              <Link
                key={child.id}
                to={`/parent/children/${child.id}`}
                className="rounded-2xl border border-cream-300/70 bg-white p-5 shadow-[0_2px_16px_-8px_rgba(11,20,48,0.1)] transition-shadow hover:shadow-[0_8px_28px_-12px_rgba(11,20,48,0.18)]"
              >
                <p className="text-base font-extrabold text-ink-900">{child.fullName}</p>
                <p className="mt-1 text-sm text-ink-500">
                  {child.pupilId} &middot; {child.className}
                </p>
                <p className="mt-3 text-xs font-semibold uppercase tracking-wider text-royal-600">
                  {child.relationship ?? 'Guardian'} {child.isPrimary ? '· Primary' : ''}
                </p>
              </Link>
            ))}
          </div>
        ) : (
          <EmptyState
            title="No children linked"
            description="The school has not yet linked any pupils to your account. Please contact the school office."
          />
        )}
      </section>
    </div>
  )
}