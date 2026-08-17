import { Building2, School, Settings as SettingsIcon } from 'lucide-react'
import { PageHeader } from '@/components/dashboard/PageHeader'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/dashboard/Badge'

const comingSoon = [
  {
    icon: School,
    title: 'School Profile',
    description: 'School name, contact details, motto and branding for the platform.',
  },
  {
    icon: Building2,
    title: 'Academic Structure',
    description: 'Classes, subjects and academic years. Arrives with the pupil management phase.',
  },
  {
    icon: SettingsIcon,
    title: 'System Preferences',
    description: 'Global platform preferences and defaults for staff accounts.',
  },
]

export function SettingsPage() {
  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Settings"
        title="Settings"
        description="Platform-wide configuration for Prime Royal Preparatory School."
        actions={<Badge tone="gold">Owner only</Badge>}
      />

      <p className="flex items-start gap-2 rounded-xl border border-cream-300 bg-cream-50 p-3.5 text-sm leading-relaxed text-ink-700">
        Settings arrive alongside their owning phases. This page is the Owner&apos;s control room and
        will gain real configuration as later phases (pupils, classes, fees, attendance and reports)
        are released.
      </p>

      <div className="grid gap-4 md:grid-cols-3">
        {comingSoon.map(({ icon: Icon, title, description }) => (
          <Card key={title} className="p-6">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-royal-600/10 text-royal-600">
              <Icon className="h-5 w-5" aria-hidden="true" />
            </span>
            <h2 className="mt-4 text-sm font-bold text-ink-900">{title}</h2>
            <p className="mt-1.5 text-sm leading-relaxed text-ink-500">{description}</p>
          </Card>
        ))}
      </div>
    </div>
  )
}