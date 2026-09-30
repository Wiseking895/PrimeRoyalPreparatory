import { beforeEach, describe, expect, it, vi } from 'vitest'

const sendMailMock = vi.hoisted(() => vi.fn())
vi.mock('nodemailer', () => ({
  default: {
    createTransport: () => ({
      sendMail: sendMailMock,
    }),
  },
}))

describe('mail.service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('sendMail', () => {
    it('reports a dev (console transport) delivery when SMTP is not configured', async () => {
      // Force the dev branch regardless of the machine's .env.
      vi.stubEnv('EMAIL_ENABLED', 'false')
      vi.stubEnv('EMAIL_HOST', '')
      vi.resetModules()
      const { sendMail } = await import('./mail.service')
      sendMailMock.mockResolvedValue({ messageId: 'dev-id', message: '{}' })

      const result = await sendMail({ to: 't@example.com', subject: 'Hi', text: 'Body' })

      expect(result.status).toBe('dev')
      expect(result.transport).toBe('dev')
      expect(sendMailMock).toHaveBeenCalledWith(
        expect.objectContaining({ to: 't@example.com', subject: 'Hi', text: 'Body' }),
      )
      vi.unstubAllEnvs()
    })

    it('reports failure when the transport rejects the message', async () => {
      vi.stubEnv('EMAIL_ENABLED', 'true')
      vi.stubEnv('EMAIL_HOST', 'smtp.example.com')
      vi.resetModules()
      const { sendMail } = await import('./mail.service')
      sendMailMock.mockRejectedValue(new Error('Connection refused'))

      const result = await sendMail({ to: 't@example.com', subject: 'Hi', text: 'Body' })

      expect(result.status).toBe('failed')
      expect(result.transport).toBe('smtp')
      expect(result.error).toContain('Connection refused')
      vi.unstubAllEnvs()
    })

    it('reports sent only when the SMTP server accepts the recipient', async () => {
      vi.stubEnv('EMAIL_ENABLED', 'true')
      vi.stubEnv('EMAIL_HOST', 'smtp.example.com')
      vi.resetModules()
      const { sendMail } = await import('./mail.service')
      sendMailMock.mockResolvedValue({ messageId: 'm1', accepted: ['t@example.com'] })

      const result = await sendMail({ to: 't@example.com', subject: 'Hi', text: 'Body' })

      expect(result.status).toBe('sent')
      expect(result.transport).toBe('smtp')
      expect(result.messageId).toBe('m1')
      vi.unstubAllEnvs()
    })

    it('reports queued when the server queues the message for later delivery', async () => {
      vi.stubEnv('EMAIL_ENABLED', 'true')
      vi.stubEnv('EMAIL_HOST', 'smtp.example.com')
      vi.resetModules()
      const { sendMail } = await import('./mail.service')
      sendMailMock.mockResolvedValue({ messageId: 'm1', accepted: [], pending: ['t@example.com'] })

      const result = await sendMail({ to: 't@example.com', subject: 'Hi', text: 'Body' })

      expect(result.status).toBe('queued')
      expect(result.transport).toBe('smtp')
      expect(result.messageId).toBe('m1')
      vi.unstubAllEnvs()
    })

    it('reports failure when the SMTP server accepts no recipient', async () => {
      vi.stubEnv('EMAIL_ENABLED', 'true')
      vi.stubEnv('EMAIL_HOST', 'smtp.example.com')
      vi.resetModules()
      const { sendMail } = await import('./mail.service')
      sendMailMock.mockResolvedValue({ messageId: 'm1', accepted: [] })

      const result = await sendMail({ to: 't@example.com', subject: 'Hi', text: 'Body' })

      expect(result.status).toBe('failed')
      expect(result.error).toContain('did not accept')
      vi.unstubAllEnvs()
    })
  })

  describe('sendHeadteacherInvitation', () => {
    it('includes the staff ID and temporary password in the message', async () => {
      vi.stubEnv('EMAIL_ENABLED', 'false')
      vi.resetModules()
      const { sendHeadteacherInvitation } = await import('./mail.service')
      sendMailMock.mockResolvedValue({ messageId: 'dev-id', message: '{}' })

      await sendHeadteacherInvitation({
        to: 'grace@school.edu',
        fullName: 'Grace Hopper',
        staffId: 'PRPS-HT-001',
        temporaryPassword: 'T0pSecret12',
      })

      const [payload] = sendMailMock.mock.calls[0]
      expect(payload.subject).toContain('Prime Royal')
      expect(payload.text).toContain('PRPS-HT-001')
      expect(payload.text).toContain('T0pSecret12')
      expect(payload.text).toContain('change your password')
      vi.unstubAllEnvs()
    })

    it('includes the staff login URL so the recipient knows where to sign in', async () => {
      vi.stubEnv('EMAIL_ENABLED', 'false')
      vi.stubEnv('CLIENT_URL', 'https://prps.example.com')
      vi.resetModules()
      const { sendHeadteacherInvitation } = await import('./mail.service')
      sendMailMock.mockResolvedValue({ messageId: 'dev-id', message: '{}' })

      await sendHeadteacherInvitation({
        to: 'grace@school.edu',
        fullName: 'Grace Hopper',
        staffId: 'PRPS-HT-001',
        temporaryPassword: 'T0pSecret12',
      })

      const [payload] = sendMailMock.mock.calls[0]
      expect(payload.text).toContain('https://prps.example.com/staff/login')
      vi.unstubAllEnvs()
    })
  })

  describe('sendStaffInvitation', () => {
    it('includes the staff ID, position and temporary password in the message', async () => {
      vi.stubEnv('EMAIL_ENABLED', 'false')
      vi.resetModules()
      const { sendStaffInvitation } = await import('./mail.service')
      sendMailMock.mockResolvedValue({ messageId: 'dev-id', message: '{}' })

      await sendStaffInvitation({
        to: 'katherine@school.edu',
        fullName: 'Katherine Johnson',
        staffId: 'PRPS-STF-0001',
        temporaryPassword: 'T0pSecret12',
        position: 'Class Teacher',
      })

      const [payload] = sendMailMock.mock.calls[0]
      expect(payload.subject).toContain('Prime Royal')
      expect(payload.subject).toContain('Class Teacher')
      expect(payload.text).toContain('PRPS-STF-0001')
      expect(payload.text).toContain('T0pSecret12')
      expect(payload.text).toContain('change your password')
      vi.unstubAllEnvs()
    })
  })

  describe('public application URL in generated links', () => {
    it('points parent invitations at the deployed frontend in production', async () => {
      vi.stubEnv('EMAIL_ENABLED', 'false')
      vi.stubEnv('NODE_ENV', 'production')
      vi.stubEnv('JWT_SECRET', 'production-secret-for-link-test')
      // A stale/mistyped CLIENT_URL must not put localhost links in real mail.
      vi.stubEnv('CLIENT_URL', 'http://localhost:5173')
      vi.resetModules()
      const { sendGuardianInvitation } = await import('./mail.service')
      sendMailMock.mockResolvedValue({ messageId: 'dev-id', message: '{}' })

      await sendGuardianInvitation({
        to: 'parent@example.com',
        fullName: 'Ada Parent',
        temporaryPassword: 'T0pSecret12',
      })

      const [payload] = sendMailMock.mock.calls[0]
      expect(payload.text).toContain(
        'Sign in to the PRPS Parent Portal at: https://prime-royal-preparatory-frontend.vercel.app/parent/login',
      )
      expect(payload.text).not.toContain('localhost')
      vi.unstubAllEnvs()
    })

    it('keeps pointing at the local dev server during development', async () => {
      vi.stubEnv('EMAIL_ENABLED', 'false')
      vi.stubEnv('NODE_ENV', 'development')
      vi.stubEnv('CLIENT_URL', '')
      vi.resetModules()
      const { sendStaffInvitation } = await import('./mail.service')
      sendMailMock.mockResolvedValue({ messageId: 'dev-id', message: '{}' })

      await sendStaffInvitation({
        to: 'teacher@example.com',
        fullName: 'Katherine Johnson',
        staffId: 'PRPS-STF-0002',
        temporaryPassword: 'T0pSecret12',
        position: 'Class Teacher',
      })

      const [payload] = sendMailMock.mock.calls[0]
      expect(payload.text).toContain('http://localhost:5173/staff/login')
      vi.unstubAllEnvs()
    })
  })
})