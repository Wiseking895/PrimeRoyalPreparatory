import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

type BadgeTone = 'green' | 'red' | 'amber' | 'blue' | 'royal' | 'magenta' | 'neutral'

const tones: Record<BadgeTone, string> = {
  green: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  red: 'bg-red-50 text-red-700 ring-red-600/20',
  amber: 'bg-amber-50 text-amber-700 ring-amber-600/25',
  blue: 'bg-sky-50 text-sky-700 ring-sky-600/20',
  royal: 'bg-royal-50 text-royal-700 ring-royal-600/20',
  magenta: 'bg-magenta-500/10 text-magenta-700 ring-magenta-600/20',
  neutral: 'bg-cream-100 text-ink-700 ring-ink-500/15',
}

interface BadgeProps {
  tone?: BadgeTone
  className?: string
  children: ReactNode
  title?: string
}

export function Badge({ tone = 'neutral', className, children, title }: BadgeProps) {
  return (
    <span
      title={title}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset',
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  )
}

export function StatusBadge({ status }: { status: 'ACTIVE' | 'INACTIVE' }) {
  if (status === 'ACTIVE') {
    return (
      <Badge tone="green">
        <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
        Active
      </Badge>
    )
  }
  return (
    <Badge tone="red">
      <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-red-500" />
      Inactive
    </Badge>
  )
}
