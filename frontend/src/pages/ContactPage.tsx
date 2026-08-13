import { Clock, Mail, MapPin, Phone } from 'lucide-react'
import { PageHero } from '@/components/common/PageHero'
import { ContactForm } from '@/components/forms/ContactForm'
import { Card } from '@/components/ui/Card'
import { Container } from '@/components/ui/Container'
import { SectionHeading } from '@/components/ui/SectionHeading'
import { siteConfig } from '@/config/site'

export default function ContactPage() {
  const { contact } = siteConfig

  const rows = [
    { icon: MapPin, label: 'School Address', value: contact.address },
    { icon: Phone, label: 'Phone', value: contact.phone },
    { icon: Mail, label: 'Email', value: contact.email },
    { icon: Clock, label: 'Office Hours', value: contact.officeHours },
  ]

  return (
    <>
      <PageHero
        eyebrow="Contact Us"
        crumb="Contact Us"
        title="We are here to help"
        description="Reach out with any questions about admissions, fees, or school life — we would love to hear from you."
      />

      <section className="bg-white">
        <Container className="py-14 sm:py-20">
          <div className="grid gap-10 lg:grid-cols-2">
            {/* Contact details */}
            <div>
              <SectionHeading
                align="left"
                eyebrow="Get in Touch"
                title="Our contact details"
                description="Visit us during office hours, give us a call, or drop us a message."
              />
              <div className="mt-8 space-y-4">
                {rows.map(({ icon: Icon, label, value }) => (
                  <Card key={label} className="flex items-start gap-4 p-5">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-royal-600 text-white">
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

              {/* Map placeholder */}
              <div className="mt-6 flex items-center justify-center rounded-2xl border border-dashed border-cream-300 bg-cream-100 p-8 text-center">
                <p className="text-sm text-ink-500">
                  <MapPin className="mx-auto mb-2 h-6 w-6 text-magenta-500" aria-hidden="true" />
                  Interactive map coming soon.
                  <br />
                  {contact.locationNote}
                </p>
              </div>
            </div>

            {/* Contact form */}
            <div>
              <SectionHeading
                align="left"
                eyebrow="Send a Message"
                title="Drop us a line"
                description="Fill in the form and we will get back to you as soon as we can."
              />
              <div className="mt-8">
                <ContactForm />
              </div>
            </div>
          </div>
        </Container>
      </section>
    </>
  )
}
