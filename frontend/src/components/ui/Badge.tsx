import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

interface BadgeProps {
  className?: string
  children: ReactNode
}

export function Badge({ className, children }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full bg-magenta-500/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.14em] text-magenta-600',
        className,
      )}
    >
      {children}
    </span>
  )
}
