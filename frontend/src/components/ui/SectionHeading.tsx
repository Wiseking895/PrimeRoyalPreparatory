import { cn } from '@/lib/cn'

interface SectionHeadingProps {
  eyebrow?: string
  title: string
  description?: string
  align?: 'left' | 'center'
  dark?: boolean
  className?: string
}

export function SectionHeading({
  eyebrow,
  title,
  description,
  align = 'center',
  dark = false,
  className,
}: SectionHeadingProps) {
  return (
    <div
      className={cn(
        'max-w-2xl',
        align === 'center' && 'mx-auto text-center',
        className,
      )}
    >
      {eyebrow ? (
        <p
          className={cn(
            'eyebrow mb-3',
            dark ? 'text-magenta-400' : 'text-magenta-600',
          )}
        >
          {eyebrow}
        </p>
      ) : null}
      <h2
        className={cn(
          'text-3xl font-extrabold tracking-tight sm:text-4xl',
          dark ? 'text-white' : 'text-ink-900',
        )}
      >
        {title}
      </h2>
      {description ? (
        <p className={cn('mt-4 text-base leading-relaxed sm:text-lg', dark ? 'text-cream-200' : 'text-ink-500')}>
          {description}
        </p>
      ) : null}
    </div>
  )
}
