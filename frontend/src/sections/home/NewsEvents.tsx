import { ArrowRight } from 'lucide-react'
import { NewsCard } from '@/components/common/NewsCard'
import { Reveal } from '@/components/common/Reveal'
import { Button } from '@/components/ui/Button'
import { Container } from '@/components/ui/Container'
import { SectionHeading } from '@/components/ui/SectionHeading'
import { getNewsItems } from '@/services/site-content'

export function NewsEvents() {
  const items = getNewsItems().slice(0, 3)

  return (
    <section className="bg-cream-100">
      <Container className="py-16 sm:py-24">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <SectionHeading
            align="left"
            eyebrow="News & Events"
            title="Latest News & Events"
            description="Moments from around our school community."
          />
          <Button to="/news" variant="outline" className="shrink-0">
            View all news
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Button>
        </div>

        <div className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {items.map((item, index) => (
            <Reveal key={item.id} delay={index * 70}>
              <NewsCard item={item} />
            </Reveal>
          ))}
        </div>
      </Container>
    </section>
  )
}
