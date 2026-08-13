import { ArrowRight, CalendarDays } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Scene } from '@/components/illustrations/Scene'
import { Card } from '@/components/ui/Card'
import { formatDate } from '@/lib/date'
import type { NewsItem } from '@/types/content'

export function NewsCard({ item }: { item: NewsItem }) {
  return (
    <Card className="group flex h-full flex-col overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_20px_48px_-14px_rgba(11,20,48,0.25)]">
      <div className="relative aspect-[16/10] overflow-hidden">
        <div className="absolute inset-0 transition-transform duration-500 group-hover:scale-105">
          <Scene name={item.scene} />
        </div>
        <span className="absolute left-4 top-4 rounded-full bg-white/95 px-3 py-1 text-xs font-bold text-royal-600">
          {item.category}
        </span>
      </div>
      <div className="flex flex-1 flex-col p-6">
        <p className="flex items-center gap-2 text-xs font-medium text-ink-500">
          <CalendarDays className="h-4 w-4 text-magenta-500" aria-hidden="true" />
          <time dateTime={item.date}>{formatDate(item.date)}</time>
        </p>
        <h3 className="mt-2 text-lg font-bold leading-snug text-ink-900">{item.title}</h3>
        <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-ink-500">{item.excerpt}</p>
        <Link
          to="/news"
          className="mt-auto inline-flex items-center gap-1.5 pt-4 text-sm font-semibold text-magenta-600 transition-colors hover:text-magenta-700"
        >
          Read more
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </div>
    </Card>
  )
}
