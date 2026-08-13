import { ArrowRight } from 'lucide-react'
import { GalleryCard } from '@/components/common/GalleryCard'
import { Button } from '@/components/ui/Button'
import { Container } from '@/components/ui/Container'
import { SectionHeading } from '@/components/ui/SectionHeading'
import { getGalleryItems } from '@/services/site-content'

export function GallerySection() {
  const items = getGalleryItems().slice(0, 6)

  return (
    <section id="school-gallery" className="bg-white">
      <Container className="py-16 sm:py-24">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <SectionHeading
            align="left"
            eyebrow="School Gallery"
            title="A glimpse into life at PRPS"
            description="Classrooms, playgrounds, sports and celebrations — see our school in action."
          />
          <Button to="/gallery" variant="outline" className="shrink-0">
            View full gallery
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Button>
        </div>

        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => (
            <GalleryCard key={item.title} item={item} />
          ))}
        </div>
      </Container>
    </section>
  )
}
