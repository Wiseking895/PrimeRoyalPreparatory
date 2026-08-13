import type { PublicUser } from '@/types/portal'

const TOKEN_KEY = 'prps.portal.token'
const USER_KEY = 'prps.portal.user'

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
}
