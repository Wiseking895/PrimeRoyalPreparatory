import type { ReactNode } from 'react'
import { UserRound } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { InfoRow } from './InfoRow'
import { ProfileSectionHeading } from './ProfileSectionHeading'

export interface AccountDetailRow {
  icon: ReactNode
  label: string
  value: string
}

interface AccountDetailsCardProps {
  description?: string
  rows: AccountDetailRow[]
}

/** Read-only ACCOUNT DETAILS card — callers pass only fields that actually exist. */
export function AccountDetailsCard({ description, rows }: AccountDetailsCardProps) {
  return (
    <Card className="p-6">
      <ProfileSectionHeading
        icon={<UserRound className="h-4.5 w-4.5" aria-hidden="true" />}
        title="Account Details"
        description={description}
      />
      <dl className="mt-4 space-y-3">
        {rows.map((row) => (
          <InfoRow key={row.label} icon={row.icon} label={row.label} value={row.value} />
        ))}
      </dl>
    </Card>
  )
}
