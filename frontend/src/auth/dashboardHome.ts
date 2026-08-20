import { ACCOUNTANT_ROLE, HEADTEACHER_ROLE, OWNER_ROLE } from '@/auth/roles'
import type { PublicUser } from '@/types/portal'

/** Canonical landing page for a signed-in user based on their highest role. */
export function dashboardHomeFor(user: PublicUser | null): string {
  if (!user) return '/login'
  // Accounts created with a temporary password must set a real password first.
  if (user.mustChangePassword) return '/change-password'
  if (user.roles.includes(OWNER_ROLE)) return '/owner/dashboard'
  if (user.roles.includes(HEADTEACHER_ROLE)) return '/headteacher/dashboard'
  if (user.roles.includes(ACCOUNTANT_ROLE)) return '/accountant/dashboard'
  return '/login'
}
