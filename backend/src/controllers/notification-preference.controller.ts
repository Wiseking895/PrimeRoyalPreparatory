import { z } from 'zod'
import { HttpStatus } from '../config/enums'
import type { AuthRequest } from '../types/auth'
import { AppError } from '../utils/app-error'
import { asyncHandler } from '../utils/async-handler'
import { ok } from '../lib/api-response'
import {
  getNotificationPreferences,
  updateNotificationPreferences,
} from '../services/notification-preference.service'
import { recordAudit } from '../services/audit.service'

const preferencesUpdateSchema = z.object({
  emailEnabled: z.boolean().optional(),
  inAppEnabled: z.boolean().optional(),
})

/**
 * GET /api/notification-preferences — get current user's notification preferences.
 */
export const getPreferencesHandler = asyncHandler(async (req: AuthRequest, res) => {
  const userId = req.user?.id
  if (!userId) throw new AppError('Authentication required.', HttpStatus.Unauthorized)

  const preferences = await getNotificationPreferences(userId)
  res.json(ok(preferences))
})

/**
 * PATCH /api/notification-preferences — update current user's notification preferences.
 */
export const updatePreferencesHandler = asyncHandler(async (req: AuthRequest, res) => {
  const userId = req.user?.id
  if (!userId) throw new AppError('Authentication required.', HttpStatus.Unauthorized)

  const parsed = preferencesUpdateSchema.safeParse(req.body)
  if (!parsed.success) {
    throw new AppError('Invalid input.', HttpStatus.BadRequest, parsed.error.flatten().fieldErrors)
  }

  const updated = await updateNotificationPreferences(userId, parsed.data)

  await recordAudit({
    actorUserId: userId,
    action: 'notification_preferences.update',
    resourceType: 'notification_preference',
    resourceId: updated.id,
    metadata: { emailEnabled: updated.emailEnabled, inAppEnabled: updated.inAppEnabled },
    ip: req.ip,
  })

  res.json(ok(updated))
})
