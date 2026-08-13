import { useState } from 'react'
import type { FormEvent } from 'react'
import {
  ArrowRight,
  BookOpen,
  BookOpenCheck,
  Crown,
  GraduationCap,
  Info,
  Lock,
  LogIn,
  Mail,
  ShieldCheck,
  Users,
  Wallet,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { PageHero } from '@/components/common/PageHero'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Container } from '@/components/ui/Container'
import { SectionHeading } from '@/components/ui/SectionHeading'
import { cn } from '@/lib/cn'

const staffRoles = [
  { icon: Crown, role: 'Owner / Proprietress', note: 'Oversee the school\u2019s overall operation.' },
  { icon: GraduationCap, role: 'Headteacher', note: 'Lead academic and whole-school leadership.' },
  {
    icon: BookOpen,
    role: 'Assistant Headteacher',
    note: 'Support school leadership and daily operations.',
  },
  { icon: Wallet, role: 'Accountant', note: 'Manage school fees, billing and finances.' },
  { icon: BookOpenCheck, role: 'Teachers', note: 'Manage classes, attendance and pupil records.' },
  { icon: Users, role: 'Non-Teaching Staff', note: 'Support the smooth running of the school.' },
]

const inputClasses =
  'h-12 w-full rounded-xl border border-cream-300 bg-white px-4 text-sm text-ink-900 outline-none transition-colors placeholder:text-ink-500/60 focus:border-magenta-500'

function SignInForm() {
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [notice, setNotice] = useState(false)

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setNotice(true)
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4">
      <div>
        <label htmlFor="staff-identifier" className="mb-1.5 block text-sm font-semibold text-ink-900">
          Staff ID or school email
        </label>
        <div className="relative">
          <Mail
            className="pointer-events-none absolute left-4 top-1/2 h-4.5 w-4.5 -translate-y-1/2 text-ink-500"
            aria-hidden="true"
          />
          <input
            id="staff-identifier"
            type="text"
            autoComplete="username"
            value={identifier}
            onChange={(event) => setIdentifier(event.target.value)}
            placeholder="e.g. TPR-0001 or name@school.ng"
            className={cn(inputClasses, 'pl-11')}
          />
        </div>
      </div>

      <div>
        <label htmlFor="staff-password" className="mb-1.5 block text-sm font-semibold text-ink-900">
          Password
        </label>
        <div className="relative">
          <Lock
            className="pointer-events-none absolute left-4 top-1/2 h-4.5 w-4.5 -translate-y-1/2 text-ink-500"
            aria-hidden="true"
          />
          <input
            id="staff-password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Enter your password"
            className={cn(inputClasses, 'pl-11')}
          />
        </div>
      </div>

      <Button type="submit" className="w-full" size="lg">
        <LogIn className="h-5 w-5" aria-hidden="true" />
        Sign In
      </Button>

      {notice ? (
        <p
          className="flex items-start gap-2 rounded-xl bg-magenta-500/10 p-3 text-sm leading-relaxed text-magenta-700"
          role="status"
        >
          <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          Staff sign-in will be available in Phase 2. Your administrator will provide your access
          credentials.
        </p>
      ) : (
        <p className="text-center text-xs text-ink-500">Sign-in will be available in Phase 2.</p>
      )}
    </form>
  )
}

export default function StaffLoginPage() {
  return (
    <>
      <PageHero
        eyebrow="Staff Portal"
        crumb="Staff Login"
        title="Welcome to the Staff Portal"
        description="A secure, private space for PRPS staff to manage school life — built on the same foundation that will power our school management platform."
      />

      <section className="bg-white">
        <Container className="py-14 sm:py-20">
          <div className="grid items-start gap-10 lg:grid-cols-2">
            {/* Sign-in card */}
            <div>
              <SectionHeading
                align="left"
                eyebrow="Staff Sign In"
                title="Sign in to your account"
                description="Use the credentials provided by the school. Staff accounts are managed by school administrators — there is no public sign-up."
              />

              <Card className="mt-8 p-6 sm:p-8">
                <div className="flex items-center gap-4">
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-royal-600 text-white">
                    <ShieldCheck className="h-6 w-6" aria-hidden="true" />
                  </span>
                  <div>
                    <h2 className="text-lg font-bold text-ink-900">Staff Portal access</h2>
                    <p className="mt-0.5 text-sm text-ink-500">
                      Owner, leadership, teachers and support staff sign in here.
                    </p>
                  </div>
                </div>

                <div className="mt-6">
                  <SignInForm />
                </div>
              </Card>

              <p className="mt-5 flex items-start gap-2 text-sm text-ink-500">
                <Info className="mt-0.5 h-4 w-4 shrink-0 text-magenta-600" aria-hidden="true" />
                Authentication is coming in Phase 2. For now this page introduces the Staff Portal
                entry point.
              </p>
            </div>

            {/* Roles */}
            <div className="overflow-hidden rounded-2xl bg-royal-800 shadow-[0_4px_24px_-8px_rgba(11,20,48,0.35)]">
              <div className="border-b border-white/10 px-6 py-6 sm:px-8">
                <h2 className="text-xl font-extrabold text-white">Who uses the Staff Portal?</h2>
                <p className="mt-2 text-sm leading-relaxed text-cream-200/90">
                  Each role gets a tailored workspace for the tasks that matter most.
                </p>
              </div>

              <ul className="divide-y divide-white/10">
                {staffRoles.map(({ icon: Icon, role, note }) => (
                  <li key={role} className="flex items-center gap-4 px-6 py-4 sm:px-8">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/10 text-magenta-400">
                      <Icon className="h-5 w-5" aria-hidden="true" />
                    </span>
                    <span>
                      <span className="block text-sm font-bold text-white">{role}</span>
                      <span className="mt-0.5 block text-xs text-cream-200/80">{note}</span>
                    </span>
                  </li>
                ))}
              </ul>

              <div className="border-t border-white/10 px-6 py-6 sm:px-8">
                <p className="text-sm text-cream-200/90">Are you a parent or guardian?</p>
                <Link
                  to="/#parent-portal"
                  className="mt-3 inline-flex items-center gap-2 rounded-full bg-magenta-500 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-magenta-600"
                >
                  Access the Parent Portal
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
              </div>
            </div>
          </div>
        </Container>
      </section>
    </>
  )
}
