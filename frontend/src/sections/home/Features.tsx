import { Reveal } from '@/components/common/Reveal'
import { Card } from '@/components/ui/Card'
import { Container } from '@/components/ui/Container'
import { DynamicIcon } from '@/components/ui/DynamicIcon'
import { SectionHeading } from '@/components/ui/SectionHeading'
import { getFeatures } from '@/services/site-content'
import { cn } from '@/lib/cn'

export function Features() {
  const features = getFeatures()

  return (
    <section className="bg-cream-100">
      <Container className="py-16 sm:py-24">
        <SectionHeading
          eyebrow="Why PRPS"
          title="A school built around your child"
          description="Everything we do is designed to help every pupil grow in knowledge, character and confidence."
        />

        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">
          {features.map((feature, index) => (
            <Reveal key={feature.title} delay={index * 60}>
              <Card className="group flex h-full flex-col items-center p-6 text-center transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_16px_40px_-12px_rgba(11,20,48,0.2)] sm:p-7">
                <span
                  className={cn(
                    'inline-flex h-14 w-14 items-center justify-center rounded-full transition-colors group-hover:bg-magenta-500 group-hover:text-white',
                    index % 2 === 0
                      ? 'bg-magenta-500/10 text-magenta-600'
                      : 'bg-royal-500/10 text-royal-600',
                  )}
                >
                  <DynamicIcon name={feature.icon} className="h-7 w-7" />
                </span>
                <h3 className="mt-5 text-base font-bold text-ink-900 sm:text-lg">{feature.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-ink-500">{feature.description}</p>
              </Card>
            </Reveal>
          ))}
        </div>
      </Container>
    </section>
  )
}