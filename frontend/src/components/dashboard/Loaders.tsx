import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

export function Spinner({ className }: { className?: string }) {
  return (
    <svg
      className={cn('h-5 w-5 animate-spin', className)}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
    </svg>
  )
}

export function FullPageLoader({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-cream-100">
      <div className="flex flex-col items-center gap-3 text-royal-700" role="status" aria-live="polite">
        <Spinner className="h-8 w-8" />
        <span className="text-sm font-semibold">{label}</span>
      </div>
    </div>
  )
}

export function CardSkeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn('animate-pulse rounded-2xl border border-cream-200 bg-white p-6', className)}
    >
      <div className="h-4 w-1/3 rounded bg-cream-200" />
      <div className="mt-4 h-8 w-1/2 rounded bg-cream-200" />
      <div className="mt-3 h-3 w-2/3 rounded bg-cream-200" />
    </div>
  )
}

export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-3" aria-hidden="true">
      {Array.from({ length: rows }).map((_, index) => (
        <div key={index} className="animate-pulse flex items-center gap-4 rounded-xl bg-white p-4">
          <div className="h-10 w-10 rounded-full bg-cream-200" />
          <div className="flex-1 space-y-2">
            <div className="h-3.5 w-1/3 rounded bg-cream-200" />
            <div className="h-3 w-1/4 rounded bg-cream-200" />
          </div>
          <div className="h-6 w-20 rounded-full bg-cream-200" />
        </div>
      ))}
    </div>
  )
}

export function SectionSkeleton({ children }: { children: ReactNode }) {
  return <div>{children}</div>
}
