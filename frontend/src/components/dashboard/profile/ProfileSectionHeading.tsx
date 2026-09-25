import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

type HeadingTone = 'royal' | 'gold' | 'magenta'

const toneClasses: Record<HeadingTone, string> = {
  royal: 'bg-royal-600/10 text-royal-600',
  gold: 'bg-gold-400/20 text-gold-700',
  magenta: 'bg-magenta-500/10 text-magenta-600',
}

interface ProfileSectionHeadingProps {
  icon: ReactNode
  title: string
  description?: string
  tone?: HeadingTone
  trailing?: ReactNode
}

export function ProfileSectionHeading({
  icon,
  title,
  description,
  tone = 'royal',
  trailing,
}: ProfileSectionHeadingProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div className="flex items-center gap-2">
        <span
          className={cn('flex h-9 w-9 items-center justify-center rounded-lg', toneClasses[tone])}
          aria-hidden="true"
        >
          {icon}
        </span>
        <div>
          <h2 className="text-sm font-bold uppercase tracking-wider text-royal-800">{title}</h2>
          {description ? <p className="text-xs text-ink-500">{description}</p> : null}
        </div>
      </div>
      {trailing}
    </div>
  )
}
