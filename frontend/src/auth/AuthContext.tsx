import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { HEADTEACHER_ROLE, OWNER_ROLE } from '@/auth/roles'
import { api } from '@/lib/api'
import { setUnauthorizedHandler } from '@/lib/api'
import { clearSession, getStoredUser, getToken, saveSession } from '@/auth/storage'
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
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<PublicUser | null>(() => getStoredUser())
  const [status, setStatus] = useState<AuthStatus>(() => (getToken() ? 'loading' : 'unauthenticated'))

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
        setStatus('unauthenticated')
      })

    setUnauthorizedHandler(() => {
      if (!active) return
      clearSession()
      setUser(null)
      setStatus('unauthenticated')
    })

    return () => {
      active = false
      setUnauthorizedHandler(null)
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
    setStatus('unauthenticated')
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      status,
      isOwner: user?.roles.includes(OWNER_ROLE) ?? false,
      isHeadteacher: user?.roles.includes(HEADTEACHER_ROLE) ?? false,
      hasPermission: (key) => user?.permissions.includes(key) ?? false,
      login,
      logout,
    }),
    [user, status, login, logout],
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
