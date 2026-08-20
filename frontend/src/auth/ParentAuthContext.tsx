import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { api, setParentUnauthorizedHandler } from '@/lib/api'
import {
  clearParentSession,
  getParentToken,
  getStoredParent,
  saveParentSession,
} from '@/auth/parentStorage'
import type { ParentProfileView } from '@/types/portal'

type ParentAuthStatus = 'loading' | 'authenticated' | 'unauthenticated'

interface ParentAuthContextValue {
  profile: ParentProfileView | null
  status: ParentAuthStatus
  login: (identifier: string, password: string) => Promise<ParentProfileView>
  logout: () => void
  refreshProfile: () => Promise<ParentProfileView | null>
}

const ParentAuthContext = createContext<ParentAuthContextValue | null>(null)

/**
 * Authentication for the Parent Portal. Completely independent from the staff
 * AuthContext: parent sessions live under their own storage keys and carry a
 * `guardian`-kind JWT, so a signed-in parent and a signed-in staff member never
 * interfere with each other.
 */
export function ParentAuthProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<ParentProfileView | null>(() => getStoredParent())
  const [status, setStatus] = useState<ParentAuthStatus>(() =>
    getParentToken() ? 'loading' : 'unauthenticated',
  )

  useEffect(() => {
    const token = getParentToken()
    if (!token) {
      setStatus('unauthenticated')
      return
    }

    let active = true
    api
      .parentMe()
      .then((result) => {
        if (!active) return
        setProfile(result)
        setStatus('authenticated')
      })
      .catch(() => {
        if (!active) return
        clearParentSession()
        setProfile(null)
        setStatus('unauthenticated')
      })

    setParentUnauthorizedHandler(() => {
      if (!active) return
      clearParentSession()
      setProfile(null)
      setStatus('unauthenticated')
    })

    return () => {
      active = false
      setParentUnauthorizedHandler(null)
    }
  }, [])

  const login = useCallback(async (identifier: string, password: string) => {
    const result = await api.parentLogin(identifier, password)
    saveParentSession(result.token, result.user)
    setProfile(result.user)
    setStatus('authenticated')
    return result.user
  }, [])

  const logout = useCallback(() => {
    clearParentSession()
    setProfile(null)
    setStatus('unauthenticated')
  }, [])

  const refreshProfile = useCallback(async () => {
    const result = await api.parentMe()
    saveParentSession(getParentToken() ?? '', result)
    setProfile(result)
    return result
  }, [])

  const value = useMemo<ParentAuthContextValue>(
    () => ({ profile, status, login, logout, refreshProfile }),
    [profile, status, login, logout, refreshProfile],
  )

  return <ParentAuthContext.Provider value={value}>{children}</ParentAuthContext.Provider>
}

export function useParentAuth(): ParentAuthContextValue {
  const context = useContext(ParentAuthContext)
  if (!context) {
    throw new Error('useParentAuth must be used within a ParentAuthProvider.')
  }
  return context
}