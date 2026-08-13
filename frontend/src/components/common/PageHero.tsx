import type { ReactNode } from 'react'
import { ChevronRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Badge } from '@/components/ui/Badge'
import { Container } from '@/components/ui/Container'

interface PageHeroProps {
  eyebrow: string
  title: string
  description: string
  crumb: string
  children?: ReactNode
}

export function PageHero({ eyebrow, title, description, crumb, children }: PageHeroProps) {
  return (
    <section className="relative overflow-hidden border-b border-cream-300/60 bg-cream-100">
      <Container className="relative py-14 sm:py-20">
        <nav aria-label="Breadcrumb" className="mb-6">
          <ol className="flex items-center gap-1.5 text-sm text-ink-500">
            <li>
              <Link to="/" className="font-medium text-ink-500 transition-colors hover:text-magenta-600">
                Home
              </Link>
            </li>
            <li aria-hidden="true">
              <ChevronRight className="h-4 w-4" />
            </li>
            <li aria-current="page" className="font-semibold text-ink-900">
              {crumb}
            </li>
          </ol>
        </nav>
        <Badge>{eyebrow}</Badge>
        <h1 className="mt-4 max-w-3xl text-4xl font-extrabold tracking-tight text-ink-900 sm:text-5xl">
          {title}
        </h1>
        <p className="mt-5 max-w-2xl text-base leading-relaxed text-ink-500 sm:text-lg">
          {description}
        </p>
        {children}
      </Container>
      <div aria-hidden="true" className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-magenta-500/10" />
      <div aria-hidden="true" className="pointer-events-none absolute -bottom-28 left-1/3 h-64 w-64 rounded-full bg-royal-500/10" />
    </section>
  )
}
