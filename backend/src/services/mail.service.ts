import nodemailer from 'nodemailer'
import type { Transporter } from 'nodemailer'
import { SCHOOL } from '../config/constants'
import { env } from '../config/env'
import { logger } from '../config/logger'

/**
 * Email service abstraction.
 *
 * - When SMTP is configured (`EMAIL_ENABLED=true` + `EMAIL_HOST` + credentials),
 *   messages are sent through the real provider.
 * - Otherwise a development "JSON transport" is used: nodemailer serializes the
 *   full message (including the temporary credential) and the service prints it
 *   to the server log instead of delivering real mail. This keeps development
 *   self-contained without inventing fake success.
 *
 * Every send reports an honest result so callers can distinguish `dev`
 * (console transport), `sent` (accepted by the SMTP server) and `failed`.
 * A failed send is never silently treated as success.
 */

export type MailStatus = 'dev' | 'sent' | 'queued' | 'failed'
export type MailTransport = 'dev' | 'smtp'

export interface MailResult {
  status: MailStatus
  messageId?: string
  error?: string
  transport?: MailTransport
}

export interface MailInput {
  to: string
  subject: string
  text: string
}

interface HeadteacherInvitationInput {
  to: string
  fullName: string
  staffId: string
  temporaryPassword: string
}

/**
 * Masks an email address for safe, non-sensitive log output (e.g. `g***@school.edu`).
 */
export function maskEmail(email: string): string {
  const at = email.indexOf('@')
  if (at <= 0) return '***'
  return `${email.slice(0, 1)}***@${email.slice(at + 1)}`
}

function createTransport(): Transporter {
  if (env.emailEnabled && env.emailHost) {
    return nodemailer.createTransport({
      host: env.emailHost,
      port: env.emailPort,
      secure: env.emailSecure,
      auth: env.emailUser ? { user: env.emailUser, pass: env.emailPassword } : undefined,
    })
  }
  return nodemailer.createTransport({ jsonTransport: true })
}

export async function sendMail(input: MailInput): Promise<MailResult> {
  const transport = createTransport()
  const isDevTransport = !(env.emailEnabled && env.emailHost)
  const transportName: MailTransport = isDevTransport ? 'dev' : 'smtp'

  try {
    const info = await transport.sendMail({
      from: env.emailFrom || `"${SCHOOL.name}" <no-reply@prps.local>`,
      to: input.to,
      subject: input.subject,
      text: input.text,
    })

    if (isDevTransport) {
      logger.info(
        { channel: 'mail', transport: transportName, messageId: info.messageId ?? undefined, message: JSON.parse(info.message as string) },
        'DEV transport — simulated email (not delivered). Configure EMAIL_* to send real mail.',
      )
      return { status: 'dev', messageId: info.messageId ?? undefined, transport: transportName }
    }

    const accepted = Array.isArray(info.accepted) ? info.accepted : []
    const pending = Array.isArray(info.pending) ? info.pending : []

    if (accepted.length > 0) {
      const result: MailResult = { status: 'sent', messageId: info.messageId ?? undefined, transport: transportName }
      logger.info(
        { channel: 'mail', transport: transportName, status: result.status, to: maskEmail(input.to) },
        'Mail delivery result.',
      )
      return result
    }

    if (pending.length > 0) {
      const result: MailResult = { status: 'queued', messageId: info.messageId ?? undefined, transport: transportName }
      logger.info(
        { channel: 'mail', transport: transportName, status: result.status, to: maskEmail(input.to) },
        'Mail delivery result.',
      )
      return result
    }

    const result: MailResult = { status: 'failed', error: 'The mail server did not accept the message.', transport: transportName }
    logger.info(
      { channel: 'mail', transport: transportName, status: result.status, to: maskEmail(input.to) },
      'Mail delivery result.',
    )
    return result
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'Unknown mail error.'
    logger.warn({ channel: 'mail', status: 'failed', transport: transportName, to: maskEmail(input.to), error: reason }, 'Outgoing email failed.')
    return { status: 'failed', error: reason, transport: transportName }
  }
}

/**
 * Composes the Headteacher invitation email and sends it. The temporary
 * password appears only inside this message (or the dev console transport) —
 * it is never written to the audit log, returned by an API response or stored.
 */
export async function sendHeadteacherInvitation(
  input: HeadteacherInvitationInput,
): Promise<MailResult> {
  const subject = `Welcome to ${SCHOOL.name} — your ${SCHOOL.abbreviation} Headteacher account`
  const staffLoginUrl = `${env.clientUrl}/staff/login`

  const text = [
    `Hello ${input.fullName},`,
    '',
    `An account has been created for you as the Headteacher of ${SCHOOL.name}.`,
    '',
    `Your staff ID is: ${input.staffId}`,
    '',
    `Your temporary password is: ${input.temporaryPassword}`,
    '',
    `Sign in to the PRPS staff portal at: ${staffLoginUrl}`,
    '',
    'You will be required to change your password before you can continue.',
    '',
    'Do not share this email. For security, delete it after you have changed your password.',
    '',
    SCHOOL.tagline,
  ].join('\n')

  return sendMail({ to: input.to, subject, text })
}
