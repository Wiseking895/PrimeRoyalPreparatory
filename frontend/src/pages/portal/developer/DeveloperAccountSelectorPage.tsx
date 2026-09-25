import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  Crown,
  GraduationCap,
  LogOut,
  ShieldCheck,
  User,
  Users,
  Wallet,
  BookOpenCheck,
  Briefcase,
  Wrench,
} from 'lucide-react'
import { useAuth } from '@/auth/AuthContext'
import { Logo } from '@/components/common/Logo'
import { Spinner } from '@/components/dashboard/Loaders'
import { api } from '@/lib/api'
import { cn } from '@/lib/cn'
import type { DeveloperAccount } from '@/types/portal'

const ROLE_GROUPS: Record<string, { label: string; icon: typeof Crown }> = {
  OWNER: { label: 'Owner', icon: Crown },
  HEADTEACHER: { label: 'Headteacher', icon: GraduationCap },
  ASSISTANT_HEADTEACHER: { label: 'Assistant Headteacher', icon: GraduationCap },
  ACCOUNTANT: { label: 'Accountant', icon: Wallet },
  CLASS_TEACHER: { label: 'Class Teacher', icon: BookOpenCheck },
  SUBJECT_TEACHER: { label: 'Subject Teacher', icon: BookOpenCheck },
  ADMINISTRATIVE_STAFF: { label: 'Administrative Staff', icon: Briefcase },
  SUPPORT_STAFF: { label: 'Support Staff', icon: Wrench },
  NON_TEACHING_STAFF: { label: 'Non-Teaching Staff', icon: Users },
}

function getRoleDisplay(roles: string[]): { primary: string; icon: typeof Crown } {
  for (const [role, info] of Object.entries(ROLE_GROUPS)) {
    if (roles.includes(role)) return { primary: info.label, icon: info.icon }
  }
  return { primary: 'Staff', icon: User }
}

function getCategoryLabel(category: string | null): string {
  switch (category) {
    case 'TEACHING':
      return 'Teaching Staff'
    case 'NON_TEACHING':
      return 'Non-Teaching Staff'
    case 'LEADERSHIP':
      return 'Leadership'
    default:
      return 'Staff'
  }
}

export default function DeveloperAccountSelectorPage() {
  const {
    user,
    isDeveloper,
    isImpersonating,
    logout,
    startImpersonation,
    stopImpersonation,
    switchAccount,
  } = useAuth()
  const navigate = useNavigate()
  const [accounts, setAccounts] = useState<DeveloperAccount[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selecting, setSelecting] = useState<string | null>(null)

  useEffect(() => {
    if (!user) {
      navigate('/login', { replace: true })
      return
    }
    if (!isDeveloper && !isImpersonating) {
      navigate('/login', { replace: true })
      return
    }

    let active = true
    setLoading(true)
    api
      .developerAccounts()
      .then((data) => {
        if (!active) return
        setAccounts(data)
        setLoading(false)
      })
      .catch((err) => {
        if (!active) return
        setError(err instanceof Error ? err.message : 'Failed to load accounts.')
        setLoading(false)
      })

    return () => {
      active = false
    }
  }, [user, isDeveloper, isImpersonating, navigate])

  const groupedAccounts = useMemo(() => {
    const groups: Record<string, DeveloperAccount[]> = {}
    for (const account of accounts) {
      const category = getCategoryLabel(account.category)
      if (!groups[category]) groups[category] = []
      groups[category].push(account)
    }
    return groups
  }, [accounts])

  const handleSelect = async (account: DeveloperAccount) => {
    setSelecting(account.id)
    setError(null)
    try {
      if (isImpersonating) {
        await switchAccount(account.id)
      } else {
        await startImpersonation(account.id)
      }
      // Navigate to the appropriate dashboard based on the selected account's roles
      const roles = account.roles
      if (roles.includes('OWNER')) navigate('/owner/dashboard', { replace: true })
      else if (roles.includes('HEADTEACHER')) navigate('/headteacher/dashboard', { replace: true })
      else if (roles.includes('ACCOUNTANT')) navigate('/accountant/dashboard', { replace: true })
      else if (roles.includes('CLASS_TEACHER') || roles.includes('SUBJECT_TEACHER'))
        navigate('/teacher/dashboard', { replace: true })
      else navigate('/login', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start impersonation.')
      setSelecting(null)
    }
  }

  const handleStopImpersonation = async () => {
    try {
      await stopImpersonation()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to exit developer mode.')
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#081536]">
        <Spinner className="h-8 w-8 text-magenta-400" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#081536]">
      {/* Header */}
      <header className="border-b border-white/[0.06] bg-[#0b1430]/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <Logo dark />
            <span className="text-[11px] font-bold uppercase tracking-wider text-cream-200/60">
              Developer Mode
            </span>
          </div>
          <button
            type="button"
            onClick={() => {
              if (isImpersonating) {
                handleStopImpersonation()
              } else {
                logout()
                navigate('/login', { replace: true })
              }
            }}
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-[13px] font-semibold text-cream-200/70 transition-colors hover:bg-white/5 hover:text-cream-100"
          >
            <LogOut className="h-4 w-4" aria-hidden="true" />
            {isImpersonating ? 'Exit Developer Mode' : 'Sign Out'}
          </button>
        </div>
      </header>

      {/* Content */}
      <main className="mx-auto max-w-5xl px-6 py-10">
        {/* Back button when impersonating */}
        {isImpersonating && (
          <button
            type="button"
            onClick={handleStopImpersonation}
            className="mb-6 flex items-center gap-2 text-sm font-semibold text-cream-200/70 transition-colors hover:text-cream-100"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Back to Developer Mode
          </button>
        )}

        {/* Title card */}
        <div className="rounded-2xl border border-white/[0.08] bg-white/[0.04] p-8">
          <div className="flex items-center gap-4">
            <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-magenta-500/20 text-magenta-300">
              <ShieldCheck className="h-7 w-7" aria-hidden="true" />
            </span>
            <div>
              <h1 className="text-2xl font-extrabold text-white">PRPS Developer Access</h1>
              <p className="mt-1 text-sm text-cream-200/70">
                Signed in as:{' '}
                <span className="font-semibold text-cream-100">{user?.email}</span>
              </p>
            </div>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="mt-6 rounded-xl bg-red-500/10 p-4 text-sm text-red-300" role="alert">
            {error}
          </div>
        )}

        {/* Account selector */}
        <div className="mt-8">
          <h2 className="mb-6 text-lg font-bold text-white">
            Choose an account to access
          </h2>

          {accounts.length === 0 ? (
            <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-8 text-center">
              <Users className="mx-auto h-10 w-10 text-cream-200/60" aria-hidden="true" />
              <p className="mt-3 text-sm text-cream-200/65">
                No active accounts are currently available for developer access.
              </p>
            </div>
          ) : (
            Object.entries(groupedAccounts).map(([category, categoryAccounts]) => (
              <div key={category} className="mb-8">
                <h3 className="mb-3 text-[11px] font-bold uppercase tracking-[0.16em] text-cream-200/60">
                  {category}
                </h3>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {categoryAccounts.map((account) => {
                    const roleDisplay = getRoleDisplay(account.roles)
                    const RoleIcon = roleDisplay.icon
                    const isSelecting = selecting === account.id
                    return (
                      <button
                        key={account.id}
                        type="button"
                        disabled={isSelecting}
                        onClick={() => handleSelect(account)}
                        className={cn(
                          'group flex items-start gap-4 rounded-xl border border-white/[0.08] bg-white/[0.03] p-5 text-left transition-all duration-200',
                          'hover:border-magenta-500/30 hover:bg-white/[0.06]',
                          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-magenta-500/50',
                          isSelecting && 'pointer-events-none opacity-60',
                        )}
                      >
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-magenta-500/10 text-magenta-300 transition-colors group-hover:bg-magenta-500/20">
                          <RoleIcon className="h-5 w-5" aria-hidden="true" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-bold text-white">{account.fullName}</p>
                          <p className="mt-0.5 text-[12px] text-cream-200/65">{roleDisplay.primary}</p>
                          {account.staffId && (
                            <p className="mt-1 text-[11px] font-mono text-cream-200/60">{account.staffId}</p>
                          )}
                        </div>
                        {isSelecting && <Spinner className="h-4 w-4 shrink-0 text-magenta-400" />}
                      </button>
                    )
                  })}
                </div>
              </div>
            ))
          )}
        </div>
      </main>
    </div>
  )
}
