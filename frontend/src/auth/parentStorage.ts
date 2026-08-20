import type { ParentProfileView } from '@/types/portal'

const TOKEN_KEY = 'prps.parent.token'
const USER_KEY = 'prps.parent.user'

/**
 * Session persistence for the Parent Portal. Uses dedicated keys so a parent's
 * session never collides with the staff session (which lives under
 * `prps.portal.*`). Only the signed JWT and a serialized profile are stored —
 * never passwords or secrets.
 */
export function getParentToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}

export function getStoredParent(): ParentProfileView | null {
  const raw = localStorage.getItem(USER_KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw) as ParentProfileView
  } catch {
    return null
  }
}

export function saveParentSession(token: string, profile: ParentProfileView): void {
  localStorage.setItem(TOKEN_KEY, token)
  localStorage.setItem(USER_KEY, JSON.stringify(profile))
}

export function clearParentSession(): void {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(USER_KEY)
}