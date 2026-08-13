import { NewsCard } from '@/components/common/NewsCard'
import { PageHero } from '@/components/common/PageHero'
import { Reveal } from '@/components/common/Reveal'
import { Container } from '@/components/ui/Container'
import { getNewsItems } from '@/services/site-content'

export default function NewsPage() {
  const items = getNewsItems()
  const [featured, ...rest] = items

  return (
    <>
      <PageHero
        eyebrow="News & Events"
        crumb="News & Events"
        title="What's happening at PRPS"
        description="School announcements, events and stories from around our community."
      />

      <section className="bg-white">
        <Container className="py-14 sm:py-20">
          {featured ? (
            <Reveal>
              <div className="mb-12">
                <p className="eyebrow mb-4 text-magenta-600">Featured</p>
                <NewsCard item={featured} />
              </div>
            </Reveal>
          ) : null}

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {rest.map((item, index) => (
              <Reveal key={item.id} delay={index * 50}>
                <NewsCard item={item} />
              </Reveal>
            ))}
          </div>

          <p className="mt-12 text-center text-sm text-ink-500">
            More news and events will appear here as they happen.
          </p>
        </Container>
      </section>
    </>
  )
}
