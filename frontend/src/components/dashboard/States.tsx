import type { ReactNode } from 'react'
import { AlertTriangle, Inbox } from 'lucide-react'

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: ReactNode
  title: string
  description?: string
  action?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-cream-300 bg-white/60 px-6 py-14 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-cream-100 text-royal-500">
        {icon ?? <Inbox className="h-7 w-7" aria-hidden="true" />}
      </span>
      <h3 className="mt-4 text-base font-bold text-ink-900">{title}</h3>
      {description ? <p className="mt-1.5 max-w-md text-sm text-ink-500">{description}</p> : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  )
}

export function ErrorState({
  title = 'Something went wrong',
  message,
  onRetry,
}: {
  title?: string
  message?: string
  onRetry?: () => void
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-red-100 bg-red-50/60 px-6 py-12 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-red-100 text-red-600">
        <AlertTriangle className="h-7 w-7" aria-hidden="true" />
      </span>
      <h3 className="mt-4 text-base font-bold text-red-800">{title}</h3>
      {message ? <p className="mt-1.5 max-w-md text-sm text-red-700/80">{message}</p> : null}
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="mt-5 rounded-full bg-royal-600 px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-royal-700"
        >
          Try again
        </button>
      ) : null}
    </div>
  )
}
