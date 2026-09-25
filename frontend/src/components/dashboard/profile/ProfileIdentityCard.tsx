import type { ReactNode } from 'react'
import { CalendarDays, Mail, Phone } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Badge, StatusBadge } from '@/components/dashboard/Badge'
import { RoleBadge } from './RoleBadge'
import { categoryDisplay, positionDisplay } from './labels'

interface ProfileIdentityCardProps {
  /** Avatar block — typically `ProfileAvatar`. */
  avatar: ReactNode
  name: string
  status: 'ACTIVE' | 'INACTIVE'
  email: string
  phone?: string | null
  staffId?: string | null
  roles?: string[]
  /** Raw position key from the staff profile (rendered via STAFF_POSITIONS). */
  position?: string | null
  category?: string | null
  /** Pre-formatted dates; omitted entirely when absent. */
  joined?: string | null
  lastLogin?: string | null
  /** Extra identity chips (e.g. linked children for parent accounts). */
  extraBadges?: ReactNode
}

export function ProfileIdentityCard({
  avatar,
  name,
  status,
  email,
  phone,
  staffId,
  roles,
  position,
  category,
  joined,
  lastLogin,
  extraBadges,
}: ProfileIdentityCardProps) {
  const positionLabel = positionDisplay(position)
  const categoryLabel = categoryDisplay(category)

  return (
    <Card className="p-6 sm:p-7">
      <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
        <div className="flex flex-col items-center gap-3 sm:items-start">{avatar}</div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2.5">
            <h2 className="text-xl font-extrabold tracking-tight text-royal-800 sm:text-2xl">
              {name}
            </h2>
            <StatusBadge status={status} />
          </div>

          <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-ink-500">
            {staffId ? (
              <span className="font-mono text-xs font-semibold text-royal-600">{staffId}</span>
            ) : null}
            <span className="inline-flex items-center gap-1.5">
              <Mail className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              {email}
            </span>
            {phone ? (
              <span className="inline-flex items-center gap-1.5">
                <Phone className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                {phone}
              </span>
            ) : null}
          </p>

          {joined || lastLogin ? (
            <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-500">
              {joined ? (
                <span className="inline-flex items-center gap-1.5">
                  <CalendarDays className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  Joined {joined}
                </span>
              ) : null}
              {lastLogin ? (
                <span className="inline-flex items-center gap-1.5">
                  <CalendarDays className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  Last sign-in {lastLogin}
                </span>
              ) : null}
            </p>
          ) : null}

          {roles?.length || positionLabel || categoryLabel || extraBadges ? (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {roles?.map((role) => <RoleBadge key={role} role={role} />)}
              {positionLabel ? <Badge tone="neutral">{positionLabel}</Badge> : null}
              {categoryLabel ? <Badge tone="neutral">{categoryLabel}</Badge> : null}
              {extraBadges}
            </div>
          ) : null}
        </div>
      </div>
    </Card>
  )
}
