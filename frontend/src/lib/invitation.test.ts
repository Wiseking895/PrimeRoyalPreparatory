import { describe, expect, it } from 'vitest'
import { invitationFeedback } from './invitation'

describe('invitationFeedback', () => {
  it('treats dev as an info notice, never a success', () => {
    const create = invitationFeedback({ status: 'dev' }, 'create')
    const resend = invitationFeedback({ status: 'dev' }, 'resend')

    expect(create.tone).toBe('info')
    expect(create.message).toContain('no real email was sent')
    expect(resend.tone).toBe('info')
    expect(resend.message).toContain('no real email was sent')
  })

  it('reports success only for sent/queued', () => {
    for (const status of ['sent', 'queued'] as const) {
      const feedback = invitationFeedback({ status, messageId: 'm1' }, 'resend')
      expect(feedback.tone).toBe('success')
      expect(feedback.message).toContain('Invitation email sent again')
    }
  })

  it('reports an error when the delivery failed', () => {
    const feedback = invitationFeedback({ status: 'failed', error: 'SMTP down' }, 'create')
    expect(feedback.tone).toBe('error')
    expect(feedback.message).toContain('could not be sent')
  })
})