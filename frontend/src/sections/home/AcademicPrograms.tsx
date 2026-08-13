import { ArrowRight } from 'lucide-react'
import { Reveal } from '@/components/common/Reveal'
import { Scene } from '@/components/illustrations/Scene'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Container } from '@/components/ui/Container'
import { DynamicIcon } from '@/components/ui/DynamicIcon'
import { SectionHeading } from '@/components/ui/SectionHeading'
import { getPrograms } from '@/services/site-content'

export function AcademicPrograms() {
  const programs = getPrograms()

  return (
    <section id="academic-programs" className="bg-cream-100">
      <Container className="py-16 sm:py-24">
        <SectionHeading
          eyebrow="Our Academic Programs"
          title="Learning paths that inspire"
          description="From the early years to primary school, every programme is designed to challenge, support and delight."
        />

        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {programs.map((program, index) => (
            <Reveal key={program.title} delay={index * 60}>
              <Card className="group h-full overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_20px_48px_-14px_rgba(11,20,48,0.25)]">
                <div className="relative aspect-[4/3] overflow-hidden">
                  <div className="absolute inset-0 transition-transform duration-500 group-hover:scale-105">
                    <Scene name={program.scene} />
                  </div>
                  <span className="absolute left-4 top-4 inline-flex h-12 w-12 items-center justify-center rounded-full bg-white text-magenta-600 shadow-md">
                    <DynamicIcon name={program.icon} className="h-6 w-6" />
                  </span>
                </div>
                <div className="p-6">
                  <h3 className="text-lg font-bold text-ink-900">{program.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-ink-500">{program.description}</p>
                  <Button to="/academics" variant="ghost-dark" className="mt-4 -ml-3 px-3 text-sm">
                    Learn more
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </Button>
                </div>
              </Card>
            </Reveal>
          ))}
        </div>

        <div className="mt-12 text-center">
          <Badge className="mb-4">Discover everything PRPS offers</Badge>
          <p className="mx-auto max-w-xl text-sm text-ink-500">
            A balanced education that combines strong academics with sports, the arts and character
            building.
          </p>
        </div>
      </Container>
    </section>
  )
}
