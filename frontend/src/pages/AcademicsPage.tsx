import { ArrowRight, CalendarRange, ClipboardCheck, Layers, Puzzle, Target } from 'lucide-react'
import { PageHero } from '@/components/common/PageHero'
import { Reveal } from '@/components/common/Reveal'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Container } from '@/components/ui/Container'
import { SectionHeading } from '@/components/ui/SectionHeading'
import { AcademicPrograms } from '@/sections/home/AcademicPrograms'

const approaches = [
  {
    icon: Target,
    title: 'Child-Centred Learning',
    description:
      'Lessons are built around how children actually learn — active, curious and hands-on.',
  },
  {
    icon: ClipboardCheck,
    title: 'Continuous Assessment',
    description:
      'We track each pupil\u2019s progress through the term so every child is supported to improve.',
  },
  {
    icon: Layers,
    title: 'Blended Teaching',
    description:
      'Time-tested teaching enriched with digital tools and modern classroom resources.',
  },
  {
    icon: Puzzle,
    title: 'Small-Group Support',
    description:
      'Extra attention for learners who need it, and stretch opportunities for high achievers.',
  },
]

const coreSubjects = [
  'English Language',
  'Mathematics',
  'Basic Science & Technology',
  'Social Studies',
  'Creative Arts',
  'Physical & Health Education',
  'ICT / Computer Studies',
  'Moral & Values Education',
  'Music & Cultural Studies',
  'Agricultural Science',
]

export default function AcademicsPage() {
  return (
    <>
      <PageHero
        eyebrow="Academics"
        crumb="Academics"
        title="A curriculum that inspires learning"
        description="From the early years to primary school, our programmes build strong foundations for life."
      />

      <AcademicPrograms />

      {/* Approach to learning */}
      <section className="bg-white">
        <Container className="py-16 sm:py-24">
          <SectionHeading
            eyebrow="How We Teach"
            title="Our approach to learning"
            description="Great teaching is about more than covering a syllabus — it is about how children grow."
          />
          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {approaches.map(({ icon: Icon, title, description }, index) => (
              <Reveal key={title} delay={index * 60}>
                <Card className="h-full p-6">
                  <span className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-magenta-500/10 text-magenta-600">
                    <Icon className="h-6 w-6" aria-hidden="true" />
                  </span>
                  <h3 className="mt-4 text-base font-bold text-ink-900">{title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-ink-500">{description}</p>
                </Card>
              </Reveal>
            ))}
          </div>
        </Container>
      </section>

      {/* Core subjects */}
      <section id="curriculum" className="bg-cream-100">
        <Container className="py-16 sm:py-24">
          <div className="grid items-start gap-10 lg:grid-cols-[1fr_1.2fr]">
            <SectionHeading
              align="left"
              eyebrow="Core Subjects"
              title="A balanced subject offering"
              description="The full subject list is configured by the school each session. This is a representative overview."
            />
            <div className="flex flex-wrap gap-3">
              {coreSubjects.map((subject) => (
                <span
                  key={subject}
                  className="rounded-full border border-cream-300 bg-white px-4 py-2 text-sm font-semibold text-royal-700"
                >
                  {subject}
                </span>
              ))}
            </div>
          </div>

          <div className="mt-14 flex flex-col items-start justify-between gap-4 rounded-2xl bg-white p-6 sm:flex-row sm:items-center sm:p-8">
            <p className="flex items-center gap-3 text-sm text-ink-500">
              <CalendarRange className="h-5 w-5 shrink-0 text-magenta-500" aria-hidden="true" />
              Academic years and terms are managed by the school. The termly calendar is shared with
              parents each session.
            </p>
            <Button to="/admissions" variant="secondary" className="shrink-0">
              Apply for Admission
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Button>
          </div>
        </Container>
      </section>
    </>
  )
}
