import { ArrowRight, Clock, Mail, MapPin, Phone } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Container } from '@/components/ui/Container'
import { SectionHeading } from '@/components/ui/SectionHeading'
import { siteConfig } from '@/config/site'
import { cn } from '@/lib/cn'

export function ContactSection() {
  const { contact } = siteConfig

  const rows = [
    { icon: MapPin, label: 'Our Address', value: contact.address },
    { icon: Phone, label: 'Call Us', value: contact.phone },
    { icon: Mail, label: 'Email Us', value: contact.email },
    { icon: Clock, label: 'Office Hours', value: contact.officeHours },
  ]

  return (
    <section id="contact" className="border-t border-cream-300/60 bg-cream-100">
      <Container className="py-16 sm:py-24">
        <SectionHeading
          eyebrow="Contact Us"
          title="We would love to hear from you"
          description="Questions about admissions, school life or anything else? Reach out and our team will be happy to help."
        />

        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {rows.map(({ icon: Icon, label, value }, index) => (
            <Card key={label} className="flex items-start gap-4 p-5">
              <span
                className={cn(
                  'flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-white',
                  index % 2 === 0 ? 'bg-royal-600' : 'bg-magenta-500',
                )}
              >
                <Icon className="h-5 w-5" aria-hidden="true" />
              </span>
              <span>
                <span className="block text-xs font-bold uppercase tracking-widest text-ink-500">
                  {label}
                </span>
                <span className="mt-1 block text-sm font-semibold text-ink-900">{value}</span>
              </span>
            </Card>
          ))}
        </div>

        <div className="mt-10 flex flex-col items-start justify-between gap-4 rounded-2xl bg-white p-6 sm:flex-row sm:items-center sm:p-8">
          <p className="max-w-xl text-sm text-ink-500">
            Prefer to send us a message? Our contact form makes it easy.
          </p>
          <Button to="/contact" variant="secondary">
            Contact us
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Button>
        </div>
      </Container>
    </section>
  )
}