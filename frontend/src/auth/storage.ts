import type { PublicUser } from '@/types/portal'

const TOKEN_KEY = 'prps.portal.token'
const USER_KEY = 'prps.portal.user'
const IMPERSONATION_KEY = 'prps.portal.impersonation'
const ACTING_USER_KEY = 'prps.portal.actingUser'

/**
 * Session persistence for the portal. Only the signed JWT and a serialized
 * copy of the signed-in user are stored — never passwords or secrets.
 */
export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}

export function getStoredUser(): PublicUser | null {
  const raw = localStorage.getItem(USER_KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw) as PublicUser
  } catch {
    return null
  }
}

export function saveSession(token: string, user: PublicUser): void {
  localStorage.setItem(TOKEN_KEY, token)
  localStorage.setItem(USER_KEY, JSON.stringify(user))
}

export function clearSession(): void {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(USER_KEY)
  localStorage.removeItem(IMPERSONATION_KEY)
  localStorage.removeItem(ACTING_USER_KEY)
}

// ---------------------------------------------------------------------------
// Developer impersonation persistence
// ---------------------------------------------------------------------------

export interface StoredImpersonation {
  /** The original developer user (before impersonation). */
  developerUser: PublicUser
}

export function getStoredImpersonation(): StoredImpersonation | null {
  const raw = localStorage.getItem(IMPERSONATION_KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw) as StoredImpersonation
  } catch {
    return null
  }
}

export function saveImpersonation(data: StoredImpersonation): void {
  localStorage.setItem(IMPERSONATION_KEY, JSON.stringify(data))
}

export function clearImpersonation(): void {
  localStorage.removeItem(IMPERSONATION_KEY)
  localStorage.removeItem(ACTING_USER_KEY)
}

export function getStoredActingUser(): PublicUser | null {
  const raw = localStorage.getItem(ACTING_USER_KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw) as PublicUser
  } catch {
    return null
  }
}

export function saveActingUser(user: PublicUser): void {
  localStorage.setItem(ACTING_USER_KEY, JSON.stringify(user))
}

export function isDeveloperEmail(email: string): boolean {
  return email === 'developer@prps.local'
}
