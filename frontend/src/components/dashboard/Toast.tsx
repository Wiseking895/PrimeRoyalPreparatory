import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { CheckCircle2, Info, XCircle } from 'lucide-react'
import { cn } from '@/lib/cn'

type ToastTone = 'success' | 'error' | 'info'

interface ToastItem {
  id: number
  tone: ToastTone
  message: string
}

interface ToastContextValue {
  push: (tone: ToastTone, message: string) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

const icons: Record<ToastTone, ReactNode> = {
  success: <CheckCircle2 className="h-5 w-5 text-emerald-500" aria-hidden="true" />,
  error: <XCircle className="h-5 w-5 text-red-500" aria-hidden="true" />,
  info: <Info className="h-5 w-5 text-royal-500" aria-hidden="true" />,
}

const tones: Record<ToastTone, string> = {
  success: 'border-emerald-200',
  error: 'border-red-200',
  info: 'border-royal-200',
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const nextId = useRef(1)

  const push = useCallback((tone: ToastTone, message: string) => {
    const id = nextId.current++
    setToasts((current) => [...current, { id, tone, message }])
    window.setTimeout(() => {
      setToasts((current) => current.filter((toast) => toast.id !== id))
    }, 4500)
  }, [])

  const value = useMemo(() => ({ push }), [push])

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed bottom-4 right-4 z-[60] flex w-[min(22rem,calc(100vw-2rem))] flex-col gap-2"
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={cn(
              'pointer-events-auto flex items-start gap-3 rounded-xl border bg-white p-3.5 shadow-lg',
              tones[toast.tone],
            )}
            role="status"
          >
            {icons[toast.tone]}
            <span className="flex-1 text-sm font-medium text-ink-900">{toast.message}</span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext)
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider.')
  }
  return context
}