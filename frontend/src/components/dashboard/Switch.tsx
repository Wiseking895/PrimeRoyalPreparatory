import { cn } from '@/lib/cn'

interface SwitchProps {
  checked: boolean
  onChange: (checked: boolean) => void
  label: string
  description?: string
  disabled?: boolean
  tone?: 'default' | 'danger'
}

/** Accessible toggle switch for permission assignment. */
export function Switch({ checked, onChange, label, description, disabled, tone = 'default' }: SwitchProps) {
  return (
    <label
      className={cn(
        'flex w-full items-start gap-3 rounded-xl border p-3.5 transition-colors',
        checked ? 'border-magenta-300 bg-magenta-500/5' : 'border-cream-300 bg-white',
        disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer hover:border-magenta-300',
      )}
    >
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          'relative mt-0.5 h-6 w-11 shrink-0 rounded-full transition-colors',
          checked ? (tone === 'danger' ? 'bg-red-500' : 'bg-magenta-500') : 'bg-cream-300',
          disabled ? 'cursor-not-allowed' : 'cursor-pointer',
        )}
      >
        <span
          aria-hidden="true"
          className={cn(
            'absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform',
            checked ? 'translate-x-[22px]' : 'translate-x-0.5',
          )}
        />
      </button>
      <span className="flex-1">
        <span className="block text-sm font-semibold text-ink-900">{label}</span>
        {description ? <span className="mt-0.5 block text-xs text-ink-500">{description}</span> : null}
      </span>
    </label>
  )
}