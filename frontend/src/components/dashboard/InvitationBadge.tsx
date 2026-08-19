import { CheckCircle2, MailX, RefreshCw } from 'lucide-react'
import type { InvitationResult } from '@/types/portal'
import { Badge } from '@/components/dashboard/Badge'

/**
 * Honest, human-readable invitation status badge. `dev` is clearly labelled as
 * a development transport capture — never presented as a real delivery.
 */
export function InvitationBadge({ invitation }: { invitation?: InvitationResult }) {
  if (!invitation) {
    return (
      <Badge tone="amber">
        <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
        Invitation pending
      </Badge>
    )
  }
  if (invitation.status === 'failed') {
    return (
      <Badge tone="red">
        <MailX className="h-3.5 w-3.5" aria-hidden="true" />
        Email failed — resend needed
      </Badge>
    )
  }
  if (invitation.status === 'dev') {
    return (
      <Badge tone="royal">
        <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
        Invitation logged (dev)
      </Badge>
    )
  }
  return (
    <Badge tone="green">
      <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
      Invitation {invitation.status === 'queued' ? 'queued for delivery' : 'sent'}
    </Badge>
  )
}