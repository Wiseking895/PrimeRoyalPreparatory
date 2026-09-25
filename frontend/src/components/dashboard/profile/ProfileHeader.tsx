import { ChevronRight } from 'lucide-react'
import { cn } from '@/lib/cn'

export interface ProfileSection {
  id: string
  label: string
}

interface ProfileHeaderProps {
  /** Root breadcrumb label, e.g. "Account" or "Parent Portal". */
  breadcrumb: string
  title: string
  description: string
  sections: ProfileSection[]
  activeSection: string
  onSectionSelect: (id: string) => void
}

export function ProfileHeader({
  breadcrumb,
  title,
  description,
  sections,
  activeSection,
  onSectionSelect,
}: ProfileHeaderProps) {
  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
      <div>
        <nav
          aria-label="Breadcrumb"
          className="flex items-center gap-1.5 text-xs font-semibold text-cream-200/70"
        >
          <span>{breadcrumb}</span>
          <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
          <span className="text-gold-300">{title}</span>
        </nav>
        <h1 className="mt-1.5 text-2xl font-extrabold tracking-tight text-white sm:text-3xl">
          {title}
        </h1>
        <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-cream-200/75">{description}</p>
      </div>

      <nav
        aria-label="Profile sections"
        className="inline-flex w-fit flex-wrap gap-1 rounded-full border border-white/10 bg-white/[0.06] p-1"
      >
        {sections.map((section) => {
          const active = activeSection === section.id
          return (
            <button
              key={section.id}
              type="button"
              aria-current={active ? 'true' : undefined}
              onClick={() => onSectionSelect(section.id)}
              className={cn(
                'rounded-full px-4 py-1.5 text-xs font-bold uppercase tracking-wider transition-colors',
                active
                  ? 'bg-white text-royal-800 shadow-sm'
                  : 'text-cream-200/80 hover:text-white',
              )}
            >
              {section.label}
            </button>
          )
        })}
      </nav>
    </div>
  )
}
