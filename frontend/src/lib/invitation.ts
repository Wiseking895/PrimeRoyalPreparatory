import type { InvitationResult } from '@/types/portal'

export type InvitationFeedback = {
  tone: 'success' | 'error' | 'info'
  message: string
}

type InvitationEntity = 'headteacher' | 'staff'

const entityName: Record<InvitationEntity, string> = {
  headteacher: 'Headteacher',
  staff: 'Staff',
}

/**
 * Maps the backend invitation status to an honest, human-readable toast.
 *
 * `dev` is an information notice (a development transport captured the message
 * — no real email was delivered), never a success message.
 */
export function invitationFeedback(
  result: InvitationResult,
  context: 'create' | 'resend',
  entity: InvitationEntity = 'headteacher',
): InvitationFeedback {
  const name = entityName[entity]
  switch (result.status) {
    case 'failed':
      return {
        tone: 'error',
        message:
          context === 'create'
            ? `${name} account created, but the invitation email could not be sent.`
            : 'A new temporary credential was generated, but the invitation email could not be sent.',
      }
    case 'sent':
    case 'queued':
      return {
        tone: 'success',
        message:
          context === 'create'
            ? `${name} account created. The invitation email has been sent.`
            : 'Invitation email sent again with a fresh temporary credential.',
      }
    case 'dev':
      return {
        tone: 'info',
        message:
          context === 'create'
            ? `${name} account created. The invitation was logged to the server console (development transport) — no real email was sent.`
            : 'A fresh temporary credential was generated. The invitation was logged to the server console (development transport) — no real email was sent.',
      }
  }
}