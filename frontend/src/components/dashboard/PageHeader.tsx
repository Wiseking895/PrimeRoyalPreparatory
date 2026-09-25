import { Fragment } from 'react'
import type { ReactNode } from 'react'
import { ChevronRight } from 'lucide-react'
import { Link } from 'react-router-dom'

export interface PageBreadcrumbItem {
  label: string
  to?: string
}

interface PageHeaderProps {
  eyebrow?: string
  title: string
  description?: string
  actions?: ReactNode
  breadcrumb?: PageBreadcrumbItem[]
}

export function PageHeader({ eyebrow, title, description, actions, breadcrumb }: PageHeaderProps) {
  return (
    <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div>
        {breadcrumb && breadcrumb.length > 0 ? (
          <nav aria-label="Breadcrumb" className="mb-2 flex flex-wrap items-center gap-1.5 text-xs font-semibold text-ink-500">
            {breadcrumb.map((item, index) => (
              <Fragment key={`${item.label}-${index}`}>
                {index > 0 ? <ChevronRight className="h-3.5 w-3.5 text-ink-400" aria-hidden="true" /> : null}
                {item.to && index < breadcrumb.length - 1 ? (
                  <Link to={item.to} className="transition-colors hover:text-magenta-600">
                    {item.label}
                  </Link>
                ) : (
                  <span className={index === breadcrumb.length - 1 ? 'text-magenta-600' : undefined}>{item.label}</span>
                )}
              </Fragment>
            ))}
          </nav>
        ) : null}
        {eyebrow ? (
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-magenta-600">{eyebrow}</p>
        ) : null}
        <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-ink-900 sm:text-3xl">{title}</h1>
        {description ? <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-500">{description}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  )
}
