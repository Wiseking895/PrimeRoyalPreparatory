import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { HEADTEACHER_ROLE, OWNER_ROLE } from '@/auth/roles'
import { api } from '@/lib/api'
import { setUnauthorizedHandler } from '@/lib/api'
import {
  clearSession,
  clearImpersonation,
  getStoredUser,
  getStoredImpersonation,
  getStoredActingUser,
  getToken,
  saveSession,
  saveImpersonation,
  saveActingUser,
  isDeveloperEmail,
} from '@/auth/storage'
import type { StoredImpersonation } from '@/auth/storage'
import type { PublicUser } from '@/types/portal'

type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated'

interface AuthContextValue {
  user: PublicUser | null
  status: AuthStatus
  isOwner: boolean
  isHeadteacher: boolean
  hasPermission: (key: string) => boolean
  login: (identifier: string, password: string) => Promise<PublicUser>
  logout: () => void
  refreshUser: () => Promise<PublicUser | null>
  /** Whether the currently authenticated user is the dedicated developer account. */
  isDeveloper: boolean
  /** The original developer user when impersonation is active. */
  developerUser: PublicUser | null
  /** The currently acting (impersonated) user, or null when not impersonating. */
  actingUser: PublicUser | null
  /** Whether the developer is currently impersonating another account. */
  isImpersonating: boolean
  /** Start impersonation of a target user. Returns the acting user. */
  startImpersonation: (targetUserId: string) => Promise<PublicUser>
  /** Stop impersonation and return to the developer's own context. */
  stopImpersonation: () => Promise<void>
  /** Switch from one impersonated account to another. */
  switchAccount: (targetUserId: string) => Promise<PublicUser>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<PublicUser | null>(() => getStoredUser())
  const [status, setStatus] = useState<AuthStatus>(() => (getToken() ? 'loading' : 'unauthenticated'))
  const [impersonation, setImpersonation] = useState<StoredImpersonation | null>(() => getStoredImpersonation())
  const [actingUser, setActingUser] = useState<PublicUser | null>(() => getStoredActingUser())

  // Register the global 401 handler unconditionally — including fresh-login
  // sessions that mounted without a token. Without this, a mid-session 401
  // clears storage but leaves React state authenticated, producing a cascade
  // of unauthenticated requests.
  useEffect(() => {
    setUnauthorizedHandler(() => {
      clearSession()
      setUser(null)
      setImpersonation(null)
      setActingUser(null)
      setStatus('unauthenticated')
    })
    return () => setUnauthorizedHandler(null)
  }, [])

  // Restore an existing session once per full page load. No retry/hammering:
  // a failure clears the stale session and flips to the login screen.
  useEffect(() => {
    const token = getToken()
    if (!token) {
      setStatus('unauthenticated')
      return
    }

    let active = true
    api
      .me()
      .then((profile) => {
        if (!active) return
        setUser(profile)
        setStatus('authenticated')
      })
      .catch(() => {
        if (!active) return
        clearSession()
        setUser(null)
        setImpersonation(null)
        setActingUser(null)
        setStatus('unauthenticated')
      })

    return () => {
      active = false
    }
  }, [])

  const login = useCallback(async (identifier: string, password: string) => {
    const result = await api.login(identifier, password)
    saveSession(result.token, result.user)
    setUser(result.user)
    setStatus('authenticated')
    return result.user
  }, [])

  const logout = useCallback(() => {
    clearSession()
    setUser(null)
    setImpersonation(null)
    setActingUser(null)
    setStatus('unauthenticated')
  }, [])

  const refreshUser = useCallback(async () => {
    const profile = await api.me()
    const token = getToken()
    if (token) {
      saveSession(token, profile)
    }
    setUser(profile)
    return profile
  }, [])

  const startImpersonation = useCallback(
    async (targetUserId: string) => {
      const result = await api.developerImpersonate(targetUserId)
      // Save the impersonation token as the active token
      saveSession(result.token, result.actingUser)
      // Store the developer context
      if (user) {
        const storedImp: StoredImpersonation = { developerUser: user }
        saveImpersonation(storedImp)
        setImpersonation(storedImp)
      }
      saveActingUser(result.actingUser)
      setActingUser(result.actingUser)
      setUser(result.actingUser)
      return result.actingUser
    },
    [user],
  )

  const stopImpersonation = useCallback(async () => {
    const result = await api.developerStopImpersonation()
    const storedImp = getStoredImpersonation()
    // Always apply the fresh developer token — even if the stored developer
    // profile is missing — otherwise the user stays on the impersonation token.
    const developerUser = storedImp?.developerUser ?? user
    if (developerUser) {
      saveSession(result.token, developerUser)
      setUser(developerUser)
    }
    clearImpersonation()
    setImpersonation(null)
    setActingUser(null)
  }, [user])

  const switchAccount = useCallback(
    async (targetUserId: string) => {
      const result = await api.developerSwitchAccount(targetUserId)
      saveSession(result.token, result.actingUser)
      saveActingUser(result.actingUser)
      setActingUser(result.actingUser)
      setUser(result.actingUser)
      return result.actingUser
    },
    [],
  )

  const isDeveloper = user ? isDeveloperEmail(user.email) && user.position === 'DEVELOPER' : false
  const isImpersonating = impersonation !== null && actingUser !== null

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      status,
      isOwner: user?.roles.includes(OWNER_ROLE) ?? false,
      isHeadteacher: user?.roles.includes(HEADTEACHER_ROLE) ?? false,
      hasPermission: (key) => user?.permissions.includes(key) ?? false,
      login,
      logout,
      refreshUser,
      isDeveloper,
      developerUser: impersonation?.developerUser ?? null,
      actingUser,
      isImpersonating,
      startImpersonation,
      stopImpersonation,
      switchAccount,
    }),
    [user, status, login, logout, refreshUser, isDeveloper, impersonation, actingUser, isImpersonating, startImpersonation, stopImpersonation, switchAccount],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider.')
  }
  return context
}
