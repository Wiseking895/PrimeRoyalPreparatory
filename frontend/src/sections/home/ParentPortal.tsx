import { useState } from 'react'
import { CheckCircle2, FileText, GraduationCap, Info, Wallet } from 'lucide-react'
import { Container } from '@/components/ui/Container'
import { SectionHeading } from '@/components/ui/SectionHeading'
import { getParentPortalFeatures } from '@/services/site-content'

const mockAppItems = [
  { icon: FileText, label: 'Terminal Report', value: 'Term 2 — Published' },
  { icon: GraduationCap, label: 'Average', value: '82%' },
  { icon: Wallet, label: 'Fee Balance', value: 'Up to date' },
]

/**
 * Visual-only phone mockup for the Parent Portal promotion. Not interactive —
 * the real portal arrives in a later phase.
 */
function PhoneMockup() {
  return (
    <div
      aria-hidden="true"
      className="mx-auto w-full max-w-[300px] overflow-hidden rounded-[2.5rem] border-[10px] border-royal-900 bg-cream-50 shadow-2xl"
    >
      <div className="flex items-center justify-between bg-royal-800 px-5 pb-3 pt-4">
        <span className="flex gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-magenta-500" />
          <span className="h-2.5 w-2.5 rounded-full bg-cream-300" />
          <span className="h-2.5 w-2.5 rounded-full bg-cream-300" />
        </span>
        <span className="text-[10px] font-bold uppercase tracking-widest text-white">PRPS Portal</span>
        <span className="text-[10px] font-semibold text-cream-200">09:41</span>
      </div>
      <div className="space-y-3 p-4">
        <div className="rounded-2xl bg-royal-700 p-4">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-cream-200">
            Welcome back
          </p>
          <p className="mt-1 text-sm font-extrabold text-white">Parent Portal</p>
        </div>
        {mockAppItems.map(({ icon: Icon, label, value }) => (
          <div key={label} className="flex items-center gap-3 rounded-2xl border border-cream-200 bg-white p-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-magenta-500/10 text-magenta-600">
              <Icon className="h-4.5 w-4.5" />
            </span>
            <span className="min-w-0">
              <span className="block text-[10px] font-semibold uppercase tracking-wider text-ink-500">
                {label}
              </span>
              <span className="block truncate text-sm font-bold text-ink-900">{value}</span>
            </span>
          </div>
        ))}
        <div className="rounded-2xl bg-magenta-500 py-3 text-center text-xs font-bold text-white">
          View Report
        </div>
      </div>
    </div>
  )
}

export function ParentPortal() {
  const features = getParentPortalFeatures()
  const [notice, setNotice] = useState(false)

  return (
    <section id="parent-portal" className="relative overflow-hidden bg-royal-700">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -left-24 top-0 h-72 w-72 rounded-full bg-magenta-500/15"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-32 -right-20 h-80 w-80 rounded-full bg-royal-500/40"
      />

      <Container className="relative grid items-center gap-12 py-16 sm:py-20 lg:grid-cols-2">
        <div>
          <SectionHeading
            align="left"
            dark
            eyebrow="Parent Portal"
            title="Access everything you need about your child, anytime, anywhere."
            description="Keep up with your child's learning journey from your phone or computer."
          />

          <ul className="mt-8 space-y-3">
            {features.map((feature) => (
              <li key={feature} className="flex items-center gap-3 text-cream-100">
                <CheckCircle2 className="h-5 w-5 shrink-0 text-magenta-400" aria-hidden="true" />
                <span className="text-base font-medium">{feature}</span>
              </li>
            ))}
          </ul>

          <div className="mt-9 flex flex-col items-start gap-4 sm:flex-row sm:items-center">
            <button
              type="button"
              onClick={() => setNotice((value) => !value)}
              className="inline-flex items-center justify-center gap-2 rounded-full bg-magenta-500 px-7 py-3.5 text-base font-semibold text-white transition-colors hover:bg-magenta-600"
            >
              Access Parent Portal
            </button>
            {notice ? (
              <p className="flex items-center gap-2 text-sm text-cream-200" role="status">
                <Info className="h-4 w-4 shrink-0 text-magenta-400" aria-hidden="true" />
                The Parent Portal will open in a later phase of the project.
              </p>
            ) : (
              <p className="text-sm text-cream-200/90">Available in a later phase</p>
            )}
          </div>
        </div>

        <PhoneMockup />
      </Container>
    </section>
  )
}
