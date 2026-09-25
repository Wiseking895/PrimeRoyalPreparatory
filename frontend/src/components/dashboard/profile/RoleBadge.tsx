import { Badge } from '@/components/dashboard/Badge'
import { cn } from '@/lib/cn'
import { roleLabel } from './labels'

interface RoleBadgeProps {
  role: string
  className?: string
}

/** Read-only pill displaying an account's actual role. Never editable. */
export function RoleBadge({ role, className }: RoleBadgeProps) {
  return (
    <Badge
      tone="gold"
      className={cn('px-2.5 py-1 font-bold uppercase tracking-wide', className)}
      title={role}
    >
      {roleLabel(role)}
    </Badge>
  )
}
