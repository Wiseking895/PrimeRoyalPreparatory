import { Building2, School, Settings as SettingsIcon } from 'lucide-react'

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
      {/* Header */}
      <div>
        <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-magenta-400">Settings</p>
        <h1 className="mt-1.5 text-2xl font-extrabold tracking-tight text-white sm:text-3xl">
          Settings
        </h1>
        <p className="mt-1.5 max-w-xl text-sm text-cream-200/50">
          Platform-wide configuration for Prime Royal Preparatory School.
        </p>
      </div>

      <p className="glass-card p-3.5 text-sm leading-relaxed text-cream-200/60">
        Settings arrive alongside their owning phases. This page is the Owner&apos;s control room and
        will gain real configuration as later phases (pupils, classes, fees, attendance and reports)
        are released.
      </p>

      <div className="grid gap-4 md:grid-cols-3">
        {comingSoon.map(({ icon: Icon, title, description }) => (
          <div key={title} className="glass-card p-6">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-magenta-500/15 text-magenta-300">
              <Icon className="h-5 w-5" aria-hidden="true" />
            </span>
            <h2 className="mt-4 text-sm font-bold text-cream-100">{title}</h2>
            <p className="mt-1.5 text-sm leading-relaxed text-cream-200/40">{description}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
