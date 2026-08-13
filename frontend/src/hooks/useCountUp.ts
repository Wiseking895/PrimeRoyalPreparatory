import { useEffect, useState } from 'react'

/**
 * Animates a number from 0 to `target` once `start` becomes true. Respects the
 * user's reduced-motion preference (final value shown immediately).
 */
export function useCountUp(target: number, duration = 1400, start: boolean): number {
  const [value, setValue] = useState(0)

  useEffect(() => {
    if (!start) {
      setValue(0)
      return
    }

    if (
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      setValue(target)
      return
    }

    let frame = 0
    const startedAt = performance.now()

    const tick = (now: number) => {
      const progress = Math.min((now - startedAt) / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      setValue(Math.round(eased * target))
      if (progress < 1) {
        frame = requestAnimationFrame(tick)
      }
    }

    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [start, target, duration])

  return value
}
