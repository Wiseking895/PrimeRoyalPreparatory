import type { ReactNode } from 'react'

interface InfoRowProps {
  icon: ReactNode
  label: string
  value: string
}

export function InfoRow({ icon, label, value }: InfoRowProps) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-cream-200 bg-cream-50 px-4 py-3">
      <span className="mt-0.5 text-royal-500" aria-hidden="true">
        {icon}
      </span>
      <div className="min-w-0">
        <dt className="text-xs font-bold uppercase tracking-wider text-ink-500">{label}</dt>
        <dd className="mt-0.5 break-words text-sm font-semibold text-ink-900">{value}</dd>
      </div>
    </div>
  )
}
