import { CheckCircle2, FileText } from 'lucide-react'
import { PageHero } from '@/components/common/PageHero'
import { Reveal } from '@/components/common/Reveal'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Container } from '@/components/ui/Container'
import { SectionHeading } from '@/components/ui/SectionHeading'
import { AdmissionProcess } from '@/sections/home/AdmissionProcess'

const checklist = [
  'Completed application form',
  'Copy of the pupil\u2019s birth certificate',
  'Recent passport photographs',
  'Transfer letter from the previous school (where applicable)',
  'Medical / health information as required',
  'Completed contact and guardian details',
]

export default function AdmissionsPage() {
  return (
    <>
      <PageHero
        eyebrow="Admissions"
        crumb="Admissions"
        title="Joining the PRPS family"
        description="We make applying to PRPS simple and stress-free. Here is everything you need to know."
      />

      <AdmissionProcess />

      {/* Application checklist */}
      <section className="bg-cream-100">
        <Container className="py-16 sm:py-24">
          <div className="grid items-center gap-12 lg:grid-cols-2">
            <SectionHeading
              align="left"
              eyebrow="Application Checklist"
              title="What you will need"
              description="These are the typical requirements for enrolment. The school office will confirm the exact list for your child\u2019s class."
            />
            <div>
              <ul className="space-y-3">
                {checklist.map((item) => (
                  <li key={item} className="flex items-start gap-3 rounded-2xl bg-white p-4 shadow-sm">
                    <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-magenta-500" aria-hidden="true" />
                    <span className="text-sm font-medium text-ink-700">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </Container>
      </section>

      {/* Fees note */}
      <section className="bg-white">
        <Container className="py-16 sm:py-20">
          <Reveal>
            <Card className="flex flex-col gap-6 p-8 sm:p-10 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-start gap-4">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-royal-600 text-white">
                  <FileText className="h-6 w-6" aria-hidden="true" />
                </span>
                <div>
                  <h2 className="text-lg font-bold text-ink-900">School fees</h2>
                  <p className="mt-1 max-w-2xl text-sm leading-relaxed text-ink-500">
                    Fees are set per academic year and communicated clearly at enrolment. The school
                    will provide a full fee schedule for your child\u2019s class and term when you
                    begin your application.
                  </p>
                </div>
              </div>
              <Button to="/contact" variant="secondary" className="shrink-0">
                Ask about fees
              </Button>
            </Card>
          </Reveal>
        </Container>
      </section>
    </>
  )
}
