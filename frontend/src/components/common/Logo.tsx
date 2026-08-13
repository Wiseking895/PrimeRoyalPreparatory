import { SCHOOL } from '@prps/shared'
import logoAsset from '@/assets/brand/logo/LogoPrps.jpeg'
import { cn } from '@/lib/cn'

interface LogoProps {
  dark?: boolean
  className?: string
  imgClassName?: string
  /** Extra classes applied to the small tagline line, e.g. to hide it on
   *  tight desktop widths so the header stays uncluttered. */
  taglineClassName?: string
}

export function Logo({ dark = false, className, imgClassName, taglineClassName }: LogoProps) {
  return (
    <span className={cn('inline-flex items-center gap-3', className)}>
      <img
        src={logoAsset}
        alt="Prime Royal Preparatory School logo"
        className={cn('h-9 w-9 rounded-xl object-cover sm:h-10 sm:w-10', imgClassName)}
      />
      <span className="flex flex-col leading-tight">
        <span
          className={cn(
            'text-base font-extrabold tracking-tight sm:text-lg',
            dark ? 'text-white' : 'text-ink-900',
          )}
        >
          {SCHOOL.shortName}
        </span>
        <span
          className={cn(
            'text-[10px] font-semibold uppercase tracking-[0.22em] sm:text-[11px]',
            dark ? 'text-cream-200' : 'text-ink-500',
            taglineClassName,
          )}
        >
          Preparatory School
        </span>
      </span>
    </span>
  )
}
