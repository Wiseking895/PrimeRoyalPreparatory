import { useEffect, useState } from 'react'
import { ArrowRight, Users } from 'lucide-react'
import { Link } from 'react-router-dom'
import { PageHeader } from '@/components/dashboard/PageHeader'
import { CardSkeleton } from '@/components/dashboard/Loaders'
import { EmptyState } from '@/components/dashboard/States'
import { api } from '@/lib/api'
import { formatDate } from '@/lib/date'
import type { ParentChildView } from '@/types/portal'

export function ParentChildrenPage() {
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
    <div className="space-y-6">
      <PageHeader
        eyebrow="Parent Portal"
        title="My Children"
        description="Select a child to view their profile, fee account and academic reports."
      />

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
              className="group flex flex-col justify-between rounded-2xl border border-cream-300/70 bg-white p-5 shadow-[0_2px_16px_-8px_rgba(11,20,48,0.1)] transition-shadow hover:shadow-[0_8px_28px_-12px_rgba(11,20,48,0.18)]"
            >
              <div>
                <p className="text-base font-extrabold text-ink-900">{child.fullName}</p>
                <p className="mt-1 text-sm text-ink-500">{child.pupilId}</p>
                <p className="mt-2 text-sm font-semibold text-royal-600">{child.className}</p>
                <p className="mt-1 text-xs text-ink-500">
                  Born {formatDate(child.dateOfBirth)} &middot; {child.gender === 'MALE' ? 'Male' : 'Female'}
                </p>
              </div>
              <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-magenta-600 group-hover:gap-2 transition-all">
                Open profile <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </span>
            </Link>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={<Users className="h-7 w-7" aria-hidden="true" />}
          title="No children linked"
          description="The school has not yet linked any pupils to your account. Please contact the school office."
        />
      )}
    </div>
  )
}