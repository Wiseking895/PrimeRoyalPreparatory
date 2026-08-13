import { HEADTEACHER_ROLE, OWNER_ROLE } from '@prps/shared'
import type { PublicUser } from '@/types/portal'

/** Canonical landing page for a signed-in user based on their highest role. */
export function dashboardHomeFor(user: PublicUser | null): string {
  if (user?.roles.includes(OWNER_ROLE)) return '/owner/dashboard'
  if (user?.roles.includes(HEADTEACHER_ROLE)) return '/headteacher/dashboard'
  return '/login'
}
