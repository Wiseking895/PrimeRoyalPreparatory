import { Sparkles } from 'lucide-react'
import { PageHero } from '@/components/common/PageHero'
import { Scene } from '@/components/illustrations/Scene'
import { Card } from '@/components/ui/Card'
import { Container } from '@/components/ui/Container'
import { SectionHeading } from '@/components/ui/SectionHeading'

const facilities = [
  { scene: 'classroom', title: 'Modern Classrooms', note: 'Bright, safe and welcoming learning spaces.' },
  { scene: 'sports', title: 'Sports & Play Areas', note: 'Plenty of room to run, play and grow strong.' },
  { scene: 'learning', title: 'Library & Reading', note: 'A calm corner of the school where books come alive.' },
  { scene: 'ict', title: 'ICT & Digital Learning', note: 'Introducing technology safely from an early age.' },
]

const activities = [
  'Football and athletics',
  'Reading club',
  'Music and cultural dance',
  'Art and crafts',
  'Quiz and spelling bees',
  'Drama and storytelling',
  'Science exploration',
  'Community service days',
]

export default function SchoolLifePage() {
  return (
    <>
      <PageHero
        eyebrow="School Life"
        crumb="School Life"
        title="Where learning and fun meet"
        description="Beyond the classroom, PRPS is a vibrant community of play, friendship, creativity and discovery."
      />

      {/* Facilities */}
      <section className="bg-white">
        <Container className="py-16 sm:py-24">
          <SectionHeading
            eyebrow="Our Campus"
            title="Facilities designed for children"
            description="Every space is planned with safety, comfort and joyful learning in mind."
          />
          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {facilities.map(({ scene, title, note }) => (
              <Card key={title} className="group overflow-hidden">
                <div className="aspect-[4/3] overflow-hidden">
                  <div className="h-full w-full transition-transform duration-500 group-hover:scale-105">
                    <Scene name={scene} />
                  </div>
                </div>
                <div className="p-5">
                  <h3 className="text-base font-bold text-ink-900">{title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-ink-500">{note}</p>
                </div>
              </Card>
            ))}
          </div>
        </Container>
      </section>

      {/* Activities & clubs */}
      <section id="activities" className="bg-cream-100">
        <Container className="py-16 sm:py-24">
          <div className="grid items-start gap-10 lg:grid-cols-[1fr_1.2fr]">
            <SectionHeading
              align="left"
              eyebrow="Activities & Clubs"
              title="Something for every child"
              description="Co-curricular activities help pupils discover talents, build confidence and make lasting friends."
            />
            <ul className="grid gap-3 sm:grid-cols-2">
              {activities.map((activity) => (
                <li
                  key={activity}
                  className="flex items-center gap-3 rounded-2xl bg-white p-4 shadow-sm"
                >
                  <Sparkles className="h-5 w-5 shrink-0 text-magenta-500" aria-hidden="true" />
                  <span className="text-sm font-semibold text-ink-700">{activity}</span>
                </li>
              ))}
            </ul>
          </div>
        </Container>
      </section>
    </>
  )
}
