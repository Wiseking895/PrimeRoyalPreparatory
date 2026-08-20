import { portalBasePath } from '@/auth/roles'

/**
 * Builds a route for the finance module given the current user's roles.
 *
 * The Accountant portal owns the module at `/accountant/<page>`. Owner and
 * Headteacher access the same pages (read-only where their permissions allow)
 * from a nested `/owner/finance/<page>` and `/headteacher/finance/<page>` so
 * the shared pages never 404 regardless of role.
 */
export function financeRoute(roles: string[], ...segments: string[]): string {
  const base = portalBasePath(roles)
  const prefix = base === '/accountant' ? '' : '/finance'
  return [base, prefix, ...segments].filter(Boolean).join('/')
}