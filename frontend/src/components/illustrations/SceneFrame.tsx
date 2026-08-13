import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

interface SceneFrameProps {
  children: ReactNode
  className?: string
}

/**
 * SVG frame used by every scene illustration. A consistent 400×300 artboard
 * keeps gallery/program/news imagery visually uniform.
 */
export function SceneFrame({ children, className }: SceneFrameProps) {
  return (
    <svg
      viewBox="0 0 400 300"
      role="img"
      aria-hidden="true"
      preserveAspectRatio="xMidYMid slice"
      className={cn('h-full w-full', className)}
    >
      {children}
    </svg>
  )
}
