import { useEffect, useRef, useState } from 'react'
import { BookOpen, GraduationCap, Smile, Users } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { Container } from '@/components/ui/Container'
import type { Stat } from '@/types/content'
import { useCountUp } from '@/hooks/useCountUp'
import { getStats } from '@/services/site-content'

const statIcons: Record<string, LucideIcon> = {
  'Years of Excellence': GraduationCap,
  'Qualified Teachers': Users,
  'Happy Pupils': Smile,
  'Academic Programs': BookOpen,
}

function StatItem({ stat, start }: { stat: Stat; start: boolean }) {
  const value = useCountUp(stat.value, 1400, start)
  const Icon = statIcons[stat.label] ?? GraduationCap

  return (
    <div className="text-center">
      <span className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-white/10 ring-1 ring-white/15">
        <Icon className="h-6 w-6 text-gold-400" aria-hidden="true" />
      </span>
      <div aria-hidden="true" className="mx-auto mb-4 h-1.5 w-10 rounded-full bg-magenta-500" />
      <p className="text-4xl font-extrabold tracking-tight text-white sm:text-5xl">
        {value}
        {stat.suffix}
      </p>
      <p className="mt-2 text-xs font-medium uppercase tracking-[0.16em] text-cream-200 sm:text-sm">
        {stat.label}
      </p>
    </div>
  )
}

export function Statistics() {
  const stats = getStats()
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const element = ref.current
    if (!element) return
    if (typeof IntersectionObserver === 'undefined') {
      setVisible(true)
      return
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry && entry.isIntersecting) {
          setVisible(true)
          observer.disconnect()
        }
      },
      { threshold: 0.3 },
    )
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  return (
    <section className="bg-royal-800" aria-label="PRPS in numbers">
      <Container className="py-14 sm:py-16">
        <div ref={ref} className="grid grid-cols-2 gap-x-6 gap-y-12 lg:grid-cols-4">
          {stats.map((stat) => (
            <StatItem key={stat.label} stat={stat} start={visible} />
          ))}
        </div>
      </Container>
    </section>
  )
}