import { Fragment } from 'react'
import { ArrowRight } from 'lucide-react'
import { Reveal } from '@/components/common/Reveal'
import { Button } from '@/components/ui/Button'
import { Container } from '@/components/ui/Container'
import { SectionHeading } from '@/components/ui/SectionHeading'
import { cn } from '@/lib/cn'
import { getAdmissionSteps } from '@/services/site-content'

export function AdmissionProcess() {
  const steps = getAdmissionSteps()

  return (
    <section className="bg-white">
      <Container className="py-16 sm:py-24">
        <SectionHeading
          eyebrow="Admissions"
          title="Our Admission Process"
          description="A simple, friendly journey from first enquiry to the first day of school."
        />

        <ol className="mt-14 flex flex-col gap-10 lg:flex-row lg:items-center lg:gap-0">
          {steps.map((step, index) => (
            <Fragment key={step.title}>
              <Reveal delay={index * 80} className="lg:flex-1">
                <li className="relative flex gap-5 lg:flex-col lg:items-center lg:gap-0 lg:px-6 lg:text-center">
                  <span
                    aria-hidden="true"
                    className={cn(
                      'absolute left-7 top-14 h-[calc(100%-2rem)] w-1 rounded-full bg-cream-300 lg:hidden',
                      index === steps.length - 1 && 'hidden',
                    )}
                  />
                  <div className="relative z-10 flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-royal-600 text-lg font-extrabold text-white shadow-lg ring-4 ring-white">
                    {String(index + 1).padStart(2, '0')}
                  </div>
                  <div className="lg:mt-5">
                    <h3 className="text-base font-bold text-ink-900">{step.title}</h3>
                    <p className="mt-1.5 text-sm leading-relaxed text-ink-500">{step.description}</p>
                  </div>
                </li>
              </Reveal>
              {index < steps.length - 1 ? (
                <ArrowRight
                  aria-hidden="true"
                  className="hidden h-6 w-6 shrink-0 self-center text-magenta-500 lg:mx-1 lg:block"
                />
              ) : null}
            </Fragment>
          ))}
        </ol>

        <div className="mt-14 text-center">
          <Button to="/admissions" size="lg">
            Start Your Application
            <ArrowRight className="h-5 w-5" aria-hidden="true" />
          </Button>
        </div>
      </Container>
    </section>
  )
}