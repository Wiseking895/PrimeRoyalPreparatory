import { ArrowLeftRight, LogOut, X } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/auth/AuthContext'
import { useToast } from '@/components/dashboard/Toast'
import { cn } from '@/lib/cn'

/**
 * Persistent developer-mode banner shown when the developer is impersonating
 * another account. Provides quick access to switch accounts or exit developer mode.
 */
export function DeveloperModeBanner() {
  const { isImpersonating, actingUser, developerUser, stopImpersonation } = useAuth()
  const navigate = useNavigate()
  const { push } = useToast()
  const [dismissed, setDismissed] = useState(false)

  if (!isImpersonating || !actingUser || !developerUser || dismissed) return null

  const handleSwitch = async () => {
    try {
      await stopImpersonation()
      navigate('/developer/accounts', { replace: true })
    } catch (err) {
      push('error', err instanceof Error ? err.message : 'Failed to exit developer mode.')
    }
  }

  const handleExit = async () => {
    try {
      await stopImpersonation()
    } catch (err) {
      push('error', err instanceof Error ? err.message : 'Failed to exit developer mode.')
    }
  }

  return (
    <div
      className={cn(
        'sticky top-0 z-50 border-b border-amber-500/20 bg-amber-500/10 backdrop-blur-md',
        'px-4 py-2 sm:px-6',
      )}
      role="status"
      aria-label="Developer mode active"
    >
      <div className="mx-auto flex max-w-[1400px] items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[12px] font-bold text-amber-300">
            <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" />
            Developer Mode
          </p>
          <p className="mt-0.5 truncate text-[11px] text-amber-200/60">
            Acting as: <span className="font-semibold text-amber-200/80">{actingUser.fullName}</span>
            {actingUser.roles.length > 0 && (
              <span className="ml-1 text-amber-200/40">
                ({actingUser.roles[0].replace(/_/g, ' ').toLowerCase()})
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleSwitch}
            className="flex items-center gap-1.5 rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-1.5 text-[11px] font-semibold text-amber-300 transition-colors hover:bg-amber-500/20"
          >
            <ArrowLeftRight className="h-3 w-3" aria-hidden="true" />
            <span className="hidden sm:inline">Switch Account</span>
          </button>
          <button
            type="button"
            onClick={handleExit}
            className="flex items-center gap-1.5 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-1.5 text-[11px] font-semibold text-red-300 transition-colors hover:bg-red-500/20"
          >
            <LogOut className="h-3 w-3" aria-hidden="true" />
            <span className="hidden sm:inline">Exit Developer Mode</span>
          </button>
          <button
            type="button"
            onClick={() => setDismissed(true)}
            className="ml-1 inline-flex h-6 w-6 items-center justify-center rounded-md text-amber-200/40 transition-colors hover:bg-amber-500/10 hover:text-amber-200/70"
            aria-label="Dismiss banner"
          >
            <X className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  )
}
