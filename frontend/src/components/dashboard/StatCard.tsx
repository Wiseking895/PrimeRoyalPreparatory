import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

interface StatCardProps {
  label: string
  value: string | number
  hint?: string
  icon: ReactNode
  tone?: 'royal' | 'magenta' | 'green' | 'gold'
  action?: ReactNode
}

const tones = {
  royal: 'bg-royal-600 text-white',
  magenta: 'bg-magenta-500 text-white',
  green: 'bg-emerald-500 text-white',
  gold: 'bg-gold-400 text-royal-800',
}

export function StatCard({ label, value, hint, icon, tone = 'royal', action }: StatCardProps) {
  return (
    <div className="rounded-2xl border border-cream-300/70 bg-white p-5 shadow-[0_2px_16px_-8px_rgba(11,20,48,0.1)]">
      <div className="flex items-start justify-between gap-3">
        <span className={cn('flex h-11 w-11 items-center justify-center rounded-xl', tones[tone])}>
          {icon}
        </span>
        {action}
      </div>
      <p className="mt-4 text-3xl font-extrabold tracking-tight text-ink-900">{value}</p>
      <p className="mt-1 text-sm font-semibold text-ink-700">{label}</p>
      {hint ? <p className="mt-0.5 text-xs text-ink-500">{hint}</p> : null}
    </div>
  )
}