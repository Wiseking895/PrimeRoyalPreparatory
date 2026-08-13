import { useState } from 'react'
import type { FormEvent } from 'react'
import { CheckCircle2, Send } from 'lucide-react'
import { cn } from '@/lib/cn'

interface ContactFormValues {
  name: string
  email: string
  phone: string
  subject: string
  message: string
}

type ContactFormErrors = Partial<Record<keyof ContactFormValues, string>>

const initialValues: ContactFormValues = {
  name: '',
  email: '',
  phone: '',
  subject: '',
  message: '',
}

const inputClasses =
  'w-full rounded-xl border border-cream-300 bg-white px-4 py-3 text-sm text-ink-900 outline-none transition-colors placeholder:text-ink-500/60 focus:border-magenta-500'

function validate(values: ContactFormValues): ContactFormErrors {
  const errors: ContactFormErrors = {}
  if (!values.name.trim()) errors.name = 'Please enter your name.'
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim())) {
    errors.email = 'Please enter a valid email address.'
  }
  if (values.subject.trim().length < 3) errors.subject = 'Please add a short subject.'
  if (values.message.trim().length < 10) {
    errors.message = 'Please write a message of at least 10 characters.'
  }
  return errors
}

export function ContactForm() {
  const [values, setValues] = useState<ContactFormValues>(initialValues)
  const [errors, setErrors] = useState<ContactFormErrors>({})
  const [submitted, setSubmitted] = useState(false)

  const setField = (field: keyof ContactFormValues, value: string) => {
    setValues((current) => ({ ...current, [field]: value }))
    if (errors[field]) {
      setErrors((current) => ({ ...current, [field]: undefined }))
    }
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const nextErrors = validate(values)
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) return
    // TODO(phase-2+): POST the message to the backend when the messaging
    // endpoint exists. Until then this is a local demo.
    setSubmitted(true)
  }

  if (submitted) {
    return (
      <div className="flex flex-col items-center rounded-2xl border border-cream-300 bg-white p-10 text-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-magenta-500/10 text-magenta-600">
          <CheckCircle2 className="h-7 w-7" aria-hidden="true" />
        </span>
        <h2 className="mt-5 text-lg font-bold text-ink-900">Message received</h2>
        <p className="mt-2 max-w-sm text-sm text-ink-500">
          Thank you for contacting Prime Royal Preparatory School. We will get back to you as soon
          as possible.
        </p>
        <button
          type="button"
          onClick={() => {
            setValues(initialValues)
            setSubmitted(false)
          }}
          className="mt-6 text-sm font-semibold text-magenta-600 hover:text-magenta-700"
        >
          Send another message
        </button>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-5">
      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor="contact-name" className="mb-1.5 block text-sm font-semibold text-ink-900">
            Full name
          </label>
          <input
            id="contact-name"
            type="text"
            autoComplete="name"
            value={values.name}
            onChange={(event) => setField('name', event.target.value)}
            className={cn(inputClasses, errors.name && 'border-magenta-600')}
            placeholder="Your name"
            aria-invalid={Boolean(errors.name)}
            aria-describedby={errors.name ? 'contact-name-error' : undefined}
          />
          {errors.name ? (
            <p id="contact-name-error" className="mt-1.5 text-xs font-medium text-magenta-700" role="alert">
              {errors.name}
            </p>
          ) : null}
        </div>
        <div>
          <label htmlFor="contact-email" className="mb-1.5 block text-sm font-semibold text-ink-900">
            Email address
          </label>
          <input
            id="contact-email"
            type="email"
            autoComplete="email"
            value={values.email}
            onChange={(event) => setField('email', event.target.value)}
            className={cn(inputClasses, errors.email && 'border-magenta-600')}
            placeholder="you@example.com"
            aria-invalid={Boolean(errors.email)}
            aria-describedby={errors.email ? 'contact-email-error' : undefined}
          />
          {errors.email ? (
            <p id="contact-email-error" className="mt-1.5 text-xs font-medium text-magenta-700" role="alert">
              {errors.email}
            </p>
          ) : null}
        </div>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor="contact-phone" className="mb-1.5 block text-sm font-semibold text-ink-900">
            Phone (optional)
          </label>
          <input
            id="contact-phone"
            type="tel"
            autoComplete="tel"
            value={values.phone}
            onChange={(event) => setField('phone', event.target.value)}
            className={inputClasses}
            placeholder="Your phone number"
          />
        </div>
        <div>
          <label htmlFor="contact-subject" className="mb-1.5 block text-sm font-semibold text-ink-900">
            Subject
          </label>
          <input
            id="contact-subject"
            type="text"
            value={values.subject}
            onChange={(event) => setField('subject', event.target.value)}
            className={cn(inputClasses, errors.subject && 'border-magenta-600')}
            placeholder="What is this about?"
            aria-invalid={Boolean(errors.subject)}
            aria-describedby={errors.subject ? 'contact-subject-error' : undefined}
          />
          {errors.subject ? (
            <p id="contact-subject-error" className="mt-1.5 text-xs font-medium text-magenta-700" role="alert">
              {errors.subject}
            </p>
          ) : null}
        </div>
      </div>

      <div>
        <label htmlFor="contact-message" className="mb-1.5 block text-sm font-semibold text-ink-900">
          Message
        </label>
        <textarea
          id="contact-message"
          rows={5}
          value={values.message}
          onChange={(event) => setField('message', event.target.value)}
          className={cn(inputClasses, 'resize-y', errors.message && 'border-magenta-600')}
          placeholder="How can we help?"
          aria-invalid={Boolean(errors.message)}
          aria-describedby={errors.message ? 'contact-message-error' : undefined}
        />
        {errors.message ? (
          <p id="contact-message-error" className="mt-1.5 text-xs font-medium text-magenta-700" role="alert">
            {errors.message}
          </p>
        ) : null}
      </div>

      <button
        type="submit"
        className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-magenta-500 px-7 text-sm font-semibold text-white transition-colors hover:bg-magenta-600 sm:w-auto"
      >
        <Send className="h-4 w-4" aria-hidden="true" />
        Send message
      </button>
    </form>
  )
}
