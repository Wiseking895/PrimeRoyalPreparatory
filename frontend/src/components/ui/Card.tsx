import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

interface CardProps {
  className?: string
  children: ReactNode
}

export function Card({ className, children }: CardProps) {
  return (
    <div
      className={cn(
        'rounded-2xl border border-cream-300/70 bg-white shadow-[0_4px_24px_-8px_rgba(11,20,48,0.12)]',
        className,
      )}
    >
      {children}
    </div>
  )
}
