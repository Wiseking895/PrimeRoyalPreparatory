import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { cn } from '@/lib/cn'

type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'cream' | 'ghost-dark' | 'soft' | 'success' | 'danger' | 'neutral'
type ButtonSize = 'sm' | 'md' | 'lg'

const variantClasses: Record<ButtonVariant, string> = {
  primary: 'bg-magenta-500 text-white shadow-sm hover:bg-magenta-600 focus-visible:ring-2 focus-visible:ring-magenta-500 focus-visible:ring-offset-2',
  secondary: 'bg-royal-600 text-white shadow-sm hover:bg-royal-700 focus-visible:ring-2 focus-visible:ring-royal-600 focus-visible:ring-offset-2',
  outline: 'border border-royal-600 text-royal-600 hover:bg-royal-600 hover:text-white focus-visible:ring-2 focus-visible:ring-royal-600 focus-visible:ring-offset-2',
  cream: 'bg-cream-100 text-royal-700 hover:bg-white focus-visible:ring-2 focus-visible:ring-royal-600 focus-visible:ring-offset-2',
  'ghost-dark': 'text-royal-700 hover:text-magenta-600 focus-visible:ring-2 focus-visible:ring-magenta-500 focus-visible:ring-offset-2',
  soft: 'border border-royal-600/15 bg-white text-royal-700 shadow-sm hover:border-magenta-500 hover:text-magenta-600 focus-visible:ring-2 focus-visible:ring-royal-600 focus-visible:ring-offset-2',
  success: 'bg-emerald-600 text-white shadow-sm hover:bg-emerald-700 focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2',
  danger: 'bg-red-600 text-white shadow-sm hover:bg-red-700 focus-visible:ring-2 focus-visible:ring-red-600 focus-visible:ring-offset-2',
  neutral: 'bg-ink-400 text-white shadow-sm hover:bg-ink-500 focus-visible:ring-2 focus-visible:ring-ink-400 focus-visible:ring-offset-2',
}

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'px-4 py-2 text-sm',
  md: 'px-5 py-2.5 text-sm',
  lg: 'px-7 py-3.5 text-base',
}

interface BaseButtonProps {
  variant?: ButtonVariant
  size?: ButtonSize
  className?: string
  children: ReactNode
  ariaLabel?: string
  disabled?: boolean
}

type ButtonAsLinkProps = BaseButtonProps & {
  to: string
  href?: never
}

type ButtonAsAnchorProps = BaseButtonProps & {
  href: string
  to?: never
}

type ButtonAsNativeProps = BaseButtonProps & {
  to?: never
  href?: never
  type?: 'button' | 'submit'
  onClick?: () => void
  disabled?: boolean
}

export type ButtonProps = ButtonAsLinkProps | ButtonAsAnchorProps | ButtonAsNativeProps

export function Button(props: ButtonProps) {
  const { variant = 'primary', size = 'md', className, children, ariaLabel } = props
  const classes = cn(
    'inline-flex items-center justify-center gap-2 rounded-full font-semibold transition-colors duration-200',
    variantClasses[variant],
    sizeClasses[size],
    className,
  )

  if ('to' in props && props.to) {
    return (
      <Link to={props.to} className={classes} aria-label={ariaLabel}>
        {children}
      </Link>
    )
  }

  if ('href' in props && props.href) {
    return (
      <a
        href={props.href}
        className={classes}
        aria-label={ariaLabel}
        {...(props.href !== '#' ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
      >
        {children}
      </a>
    )
  }

  const { type = 'button', onClick, disabled } = props as ButtonAsNativeProps
  const disabledClasses = disabled ? 'opacity-50 cursor-not-allowed' : ''
  return (
    <button type={type} className={cn(classes, disabledClasses)} onClick={onClick} disabled={disabled} aria-label={ariaLabel} aria-disabled={disabled}>
      {children}
    </button>
  )
}
