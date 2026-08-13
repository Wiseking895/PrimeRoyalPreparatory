import { Quote } from 'lucide-react'
import { PageHero } from '@/components/common/PageHero'
import { Reveal } from '@/components/common/Reveal'
import { Card } from '@/components/ui/Card'
import { Container } from '@/components/ui/Container'
import { DynamicIcon } from '@/components/ui/DynamicIcon'
import { SectionHeading } from '@/components/ui/SectionHeading'
import { Features } from '@/sections/home/Features'
import { Statistics } from '@/sections/home/Statistics'
import { getValues } from '@/services/site-content'

const pillars = [
  {
    title: 'Our Mission',
    description:
      'To empower every child through a quality, well-rounded education that builds strong academic foundations, good character and a lifelong love of learning.',
    icon: 'Target',
  },
  {
    title: 'Our Vision',
    description:
      'To be a leading preparatory school known for excellence, where every pupil is nurtured to reach their full potential in a caring and inspiring environment.',
    icon: 'Eye',
  },
  {
    title: 'Our Promise',
    description:
      'A safe, supportive and stimulating school community where children are known, valued and encouraged to become confident, responsible citizens.',
    icon: 'HeartHandshake',
  },
]

export default function AboutPage() {
  const values = getValues()

  return (
    <>
      <PageHero
        eyebrow="About Us"
        crumb="About Us"
        title="Welcome to Prime Royal Preparatory School"
        description="A warm, welcoming school where every child matters — and every day is an opportunity to grow."
      />

      {/* Mission / Vision / Promise */}
      <section id="mission-vision" className="bg-white">
        <Container className="py-16 sm:py-20">
          <div className="grid gap-6 md:grid-cols-3">
            {pillars.map((pillar, index) => (
              <Reveal key={pillar.title} delay={index * 70}>
                <Card className="h-full p-7">
                  <span className="inline-flex h-13 w-13 items-center justify-center rounded-2xl bg-royal-600 text-white">
                    <DynamicIcon name={pillar.icon} className="h-6.5 w-6.5" />
                  </span>
                  <h2 className="mt-5 text-lg font-bold text-ink-900">{pillar.title}</h2>
                  <p className="mt-2 text-sm leading-relaxed text-ink-500">{pillar.description}</p>
                </Card>
              </Reveal>
            ))}
          </div>
        </Container>
      </section>

      {/* Message from leadership */}
      <section id="school-leadership" className="bg-cream-100">
        <Container className="py-16 sm:py-20">
          <Card className="relative overflow-hidden p-8 sm:p-12">
            <Quote className="h-12 w-12 text-magenta-500/25" aria-hidden="true" />
            <blockquote className="mt-4 max-w-3xl text-xl font-medium leading-relaxed text-ink-700 sm:text-2xl">
              At Prime Royal, our doors are open, our hearts are welcoming, and our goal is simple:
              to give every child the very best start in life.
            </blockquote>
            <p className="mt-6 text-sm font-bold uppercase tracking-widest text-magenta-600">
              A message from the school leadership
            </p>
            <p className="mt-1 text-sm text-ink-500">— Message to be provided by the school.</p>
          </Card>
        </Container>
      </section>

      <div id="why-choose-us">
        <Features />
      </div>

      {/* Core values */}
      <section className="bg-cream-100">
        <Container className="pb-16 sm:pb-24">
          <SectionHeading
            eyebrow="Our Values"
            title="The values we live by"
            description="These principles guide everything we teach and everything we do."
          />
          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {values.map((value, index) => (
              <Reveal key={value.title} delay={index * 60}>
                <Card className="group h-full p-7 transition-all duration-300 hover:-translate-y-1">
                  <span className="inline-flex h-13 w-13 items-center justify-center rounded-2xl bg-magenta-500/10 text-magenta-600 transition-colors group-hover:bg-magenta-500 group-hover:text-white">
                    <DynamicIcon name={value.icon} className="h-6.5 w-6.5" />
                  </span>
                  <h3 className="mt-5 text-lg font-bold text-ink-900">{value.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-ink-500">{value.description}</p>
                </Card>
              </Reveal>
            ))}
          </div>
        </Container>
      </section>

      <Statistics />
    </>
  )
}
