import { useMemo, useState } from 'react'
import { GalleryCard } from '@/components/common/GalleryCard'
import { PageHero } from '@/components/common/PageHero'
import { Container } from '@/components/ui/Container'
import { cn } from '@/lib/cn'
import { getGalleryItems } from '@/services/site-content'

export default function GalleryPage() {
  const items = getGalleryItems()
  const categories = useMemo(
    () => ['All', ...Array.from(new Set(items.map((item) => item.category)))],
    [items],
  )
  const [active, setActive] = useState('All')

  const visible = active === 'All' ? items : items.filter((item) => item.category === active)

  return (
    <>
      <PageHero
        eyebrow="School Gallery"
        crumb="Gallery"
        title="Moments from our school"
        description="Classrooms, playgrounds, sports and celebrations — a snapshot of everyday life at PRPS."
      />

      <section className="bg-white">
        <Container className="py-14 sm:py-20">
          <div className="flex flex-wrap gap-2" role="group" aria-label="Filter gallery by category">
            {categories.map((category) => (
              <button
                key={category}
                type="button"
                onClick={() => setActive(category)}
                aria-pressed={active === category}
                className={cn(
                  'rounded-full px-4 py-2 text-sm font-semibold transition-colors',
                  active === category
                    ? 'bg-magenta-500 text-white'
                    : 'bg-cream-200 text-ink-700 hover:bg-cream-300',
                )}
              >
                {category}
              </button>
            ))}
          </div>

          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {visible.map((item) => (
              <GalleryCard key={item.title} item={item} />
            ))}
          </div>
        </Container>
      </section>
    </>
  )
}
