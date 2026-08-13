import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react'
import { cn } from '@/lib/cn'

const baseClasses =
  'w-full rounded-xl border border-cream-300 bg-white px-4 py-2.5 text-sm text-ink-900 outline-none transition-colors placeholder:text-ink-500/60 focus:border-magenta-500'

function FieldShell({
  label,
  htmlFor,
  required,
  error,
  hint,
  children,
}: {
  label: string
  htmlFor: string
  required?: boolean
  error?: string
  hint?: string
  children: ReactNode
}) {
  return (
    <div>
      <label htmlFor={htmlFor} className="mb-1.5 block text-sm font-semibold text-ink-900">
        {label}
        {required ? <span className="ml-0.5 text-magenta-600" aria-hidden="true">*</span> : null}
      </label>
      {children}
      {hint && !error ? <p className="mt-1.5 text-xs text-ink-500">{hint}</p> : null}
      {error ? (
        <p id={`${htmlFor}-error`} className="mt-1.5 text-xs font-medium text-red-600" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  )
}

interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string
  error?: string
  hint?: string
}

export function TextField({ label, error, hint, id, required, className, ...rest }: TextFieldProps) {
  const inputId = id ?? rest.name ?? label.toLowerCase().replace(/\s+/g, '-')
  return (
    <FieldShell label={label} htmlFor={inputId} required={required} error={error} hint={hint}>
      <input
        id={inputId}
        required={required}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${inputId}-error` : undefined}
        className={cn(baseClasses, error ? 'border-red-300' : '', className)}
        {...rest}
      />
    </FieldShell>
  )
}

interface SelectFieldProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string
  error?: string
  hint?: string
  options: Array<{ value: string; label: string }>
  placeholder?: string
}

export function SelectField({
  label,
  error,
  hint,
  id,
  options,
  placeholder,
  required,
  className,
  ...rest
}: SelectFieldProps) {
  const inputId = id ?? rest.name ?? label.toLowerCase().replace(/\s+/g, '-')
  return (
    <FieldShell label={label} htmlFor={inputId} required={required} error={error} hint={hint}>
      <select
        id={inputId}
        required={required}
        aria-invalid={Boolean(error)}
        className={cn(baseClasses, 'appearance-none', error ? 'border-red-300' : '', className)}
        {...rest}
      >
        {placeholder ? (
          <option value="" disabled>
            {placeholder}
          </option>
        ) : null}
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </FieldShell>
  )
}

interface TextAreaFieldProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string
  error?: string
  hint?: string
}

export function TextAreaField({ label, error, hint, id, required, className, ...rest }: TextAreaFieldProps) {
  const inputId = id ?? rest.name ?? label.toLowerCase().replace(/\s+/g, '-')
  return (
    <FieldShell label={label} htmlFor={inputId} required={required} error={error} hint={hint}>
      <textarea
        id={inputId}
        required={required}
        aria-invalid={Boolean(error)}
        className={cn(baseClasses, 'min-h-24 resize-y', error ? 'border-red-300' : '', className)}
        {...rest}
      />
    </FieldShell>
  )
}