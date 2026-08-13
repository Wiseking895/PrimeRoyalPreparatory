import { useState } from 'react'
import type { FormEvent } from 'react'
import { Clock, Facebook, Instagram, Mail, MapPin, Phone, Send, Twitter } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Logo } from '@/components/common/Logo'
import { Container } from '@/components/ui/Container'
import { siteConfig } from '@/config/site'
import { footerProgramLinks, navLinks } from '@/data/nav'
import { cn } from '@/lib/cn'

const socialLinks = [
  { label: 'Facebook', href: siteConfig.social.facebook, icon: Facebook },
  { label: 'Instagram', href: siteConfig.social.instagram, icon: Instagram },
  { label: 'Twitter / X', href: siteConfig.social.twitter, icon: Twitter },
  { label: 'WhatsApp', href: siteConfig.social.whatsapp, icon: Phone },
]

export function Footer() {
  const [email, setEmail] = useState('')
  const [subscribed, setSubscribed] = useState(false)
  const [error, setError] = useState('')

  const handleSubscribe = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const value = email.trim()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      setError('Please enter a valid email address.')
      return
    }
    setError('')
    setSubscribed(true)
    // TODO(phase-2+): wire newsletter subscription to the backend API.
  }

  return (
    <footer className="bg-royal-800 text-cream-100">
      <Container className="py-14 sm:py-16">
        <div className="grid gap-12 lg:grid-cols-[1.4fr_1fr_1fr_1.2fr]">
          {/* Brand */}
          <div>
            <Logo dark />
            <p className="mt-5 max-w-xs text-sm leading-relaxed text-cream-200/90">
              {siteConfig.motto.charAt(0) + siteConfig.motto.slice(1).toLowerCase()} — nurturing young
              minds with quality education, strong values and a passion for excellence.
            </p>
            <div className="mt-6 flex gap-3">
              {socialLinks.map(({ label, href, icon: Icon }) => (
                <a
                  key={label}
                  href={href}
                  aria-label={`${label} — coming soon`}
                  title={`${label} — coming soon`}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-cream-100 transition-colors hover:bg-magenta-500"
                >
                  <Icon className="h-4.5 w-4.5" aria-hidden="true" />
                </a>
              ))}
            </div>
          </div>

          {/* Quick links */}
          <nav aria-label="Quick links">
            <h3 className="text-sm font-bold uppercase tracking-[0.18em] text-white">Quick Links</h3>
            <ul className="mt-5 space-y-3">
              {navLinks.map((link) => (
                <li key={link.path}>
                  <Link
                    to={link.path}
                    className="text-sm text-cream-200/90 transition-colors hover:text-magenta-400"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          {/* Programs */}
          <nav aria-label="Programs">
            <h3 className="text-sm font-bold uppercase tracking-[0.18em] text-white">Programs</h3>
            <ul className="mt-5 space-y-3">
              {footerProgramLinks.map((link) => (
                <li key={link.label}>
                  <Link
                    to={link.path}
                    className="text-sm text-cream-200/90 transition-colors hover:text-magenta-400"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          {/* Contact */}
          <div>
            <h3 className="text-sm font-bold uppercase tracking-[0.18em] text-white">Connect With Us</h3>
            <ul className="mt-5 space-y-4 text-sm text-cream-200/90">
              <li className="flex gap-3">
                <MapPin className="mt-0.5 h-4.5 w-4.5 shrink-0 text-magenta-400" aria-hidden="true" />
                <span>{siteConfig.contact.address}</span>
              </li>
              <li className="flex gap-3">
                <Phone className="mt-0.5 h-4.5 w-4.5 shrink-0 text-magenta-400" aria-hidden="true" />
                <span>{siteConfig.contact.phone}</span>
              </li>
              <li className="flex gap-3">
                <Mail className="mt-0.5 h-4.5 w-4.5 shrink-0 text-magenta-400" aria-hidden="true" />
                <span>{siteConfig.contact.email}</span>
              </li>
              <li className="flex gap-3">
                <Clock className="mt-0.5 h-4.5 w-4.5 shrink-0 text-magenta-400" aria-hidden="true" />
                <span>{siteConfig.contact.officeHours}</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Newsletter */}
        <div className="mt-12 rounded-2xl bg-white/5 p-6 sm:p-8">
          <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
            <div>
              <h3 className="text-lg font-bold text-white">Stay up to date</h3>
              <p className="mt-1 text-sm text-cream-200/90">
                Subscribe for school news, events and announcements.
              </p>
            </div>
            {subscribed ? (
              <p className="text-sm font-semibold text-magenta-400" role="status">
                Thank you for subscribing!
              </p>
            ) : (
              <form
                onSubmit={handleSubscribe}
                noValidate
                className="flex w-full max-w-md flex-col gap-2 sm:flex-row"
              >
                <label htmlFor="newsletter-email" className="sr-only">
                  Email address
                </label>
                <input
                  id="newsletter-email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="Enter your email"
                  className={cn(
                    'h-12 flex-1 rounded-full border bg-cream-50 px-5 text-sm text-ink-900 outline-none transition-colors placeholder:text-ink-500/60 focus:border-magenta-500',
                    error ? 'border-magenta-600' : 'border-transparent',
                  )}
                  aria-invalid={Boolean(error)}
                  aria-describedby={error ? 'newsletter-error' : undefined}
                />
                <button
                  type="submit"
                  className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-magenta-500 px-6 text-sm font-semibold text-white transition-colors hover:bg-magenta-600"
                >
                  <Send className="h-4 w-4" aria-hidden="true" />
                  Subscribe
                </button>
              </form>
            )}
          </div>
          {error ? (
            <p id="newsletter-error" className="mt-3 text-sm text-magenta-400" role="alert">
              {error}
            </p>
          ) : null}
        </div>

        {/* Bottom bar */}
        <div className="mt-10 flex flex-col items-center justify-between gap-4 border-t border-white/10 pt-8 text-sm text-cream-200/80 sm:flex-row">
          <p>
            &copy; {new Date().getFullYear()} {siteConfig.name}. All rights reserved.
          </p>
          <div className="flex items-center gap-6">
            <a
              href="#"
              title="Privacy Policy — coming soon"
              className="transition-colors hover:text-magenta-400"
            >
              Privacy Policy
            </a>
            <a
              href="#"
              title="Terms of Use — coming soon"
              className="transition-colors hover:text-magenta-400"
            >
              Terms of Use
            </a>
          </div>
        </div>
      </Container>
    </footer>
  )
}
