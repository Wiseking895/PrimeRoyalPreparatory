import { prisma } from '../lib/prisma'

/**
 * Notification preferences service — manages per-user notification channel
 * preferences. Defaults are applied when preferences are first accessed;
 * users can customise their preferences.
 */

export interface NotificationPreferenceView {
  id: string
  userId: string
  emailEnabled: boolean
  inAppEnabled: boolean
  createdAt: Date
  updatedAt: Date
}

/**
 * Gets or creates notification preferences for a user.
 * Returns defaults if no preferences exist yet.
 */
export async function getNotificationPreferences(
  userId: string,
): Promise<NotificationPreferenceView> {
  let preference = await prisma.notificationPreference.findUnique({
    where: { userId },
  })

  if (!preference) {
    preference = await prisma.notificationPreference.create({
      data: { userId },
    })
  }

  return preference
}

/**
 * Updates notification preferences for a user.
 */
export async function updateNotificationPreferences(
  userId: string,
  input: { emailEnabled?: boolean; inAppEnabled?: boolean },
): Promise<NotificationPreferenceView> {
  let preference = await prisma.notificationPreference.findUnique({
    where: { userId },
  })

  if (!preference) {
    preference = await prisma.notificationPreference.create({
      data: {
        userId,
        emailEnabled: input.emailEnabled ?? true,
        inAppEnabled: input.inAppEnabled ?? true,
      },
    })
  } else {
    preference = await prisma.notificationPreference.update({
      where: { userId },
      data: {
        ...(input.emailEnabled !== undefined && { emailEnabled: input.emailEnabled }),
        ...(input.inAppEnabled !== undefined && { inAppEnabled: input.inAppEnabled }),
      },
    })
  }

  return preference
}

/**
 * Checks if a user has in-app notifications enabled.
 */
export async function isInAppEnabled(userId: string): Promise<boolean> {
  const preference = await prisma.notificationPreference.findUnique({
    where: { userId },
  })
  return preference?.inAppEnabled ?? true
}

/**
 * Checks if a user has email notifications enabled.
 */
export async function isEmailEnabled(userId: string): Promise<boolean> {
  const preference = await prisma.notificationPreference.findUnique({
    where: { userId },
  })
  return preference?.emailEnabled ?? true
}
