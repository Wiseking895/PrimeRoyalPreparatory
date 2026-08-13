import { ArrowRight, PhoneCall } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Container } from '@/components/ui/Container'

export function CtaBanner() {
  return (
    <section className="bg-cream-100">
      <Container className="py-12 sm:py-16">
        <div className="relative overflow-hidden rounded-3xl bg-royal-700 px-6 py-12 text-center sm:px-12 sm:py-16">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -left-16 -top-16 h-52 w-52 rounded-full bg-magenta-500/20"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -bottom-20 -right-10 h-60 w-60 rounded-full bg-royal-500/40"
          />

          <h2 className="relative mx-auto max-w-2xl text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
            Give your child a great start at <span className="text-magenta-400">PRPS</span>
          </h2>
          <p className="relative mx-auto mt-4 max-w-xl text-base text-cream-200">
            Enrolment for the new academic year is open. Join a school family that believes in
            empowerment through education.
          </p>
          <div className="relative mt-8 flex flex-wrap items-center justify-center gap-3">
            <Button to="/admissions" size="lg">
              Apply for Admission
              <ArrowRight className="h-5 w-5" aria-hidden="true" />
            </Button>
            <Button to="/contact" variant="cream" size="lg">
              <PhoneCall className="h-5 w-5" aria-hidden="true" />
              Talk to Us
            </Button>
          </div>
        </div>
      </Container>
    </section>
  )
}
