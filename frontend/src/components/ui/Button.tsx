import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { cn } from '@/lib/cn'

type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'cream' | 'ghost-dark' | 'soft'
type ButtonSize = 'sm' | 'md' | 'lg'

const variantClasses: Record<ButtonVariant, string> = {
  primary: 'bg-magenta-500 text-white shadow-sm hover:bg-magenta-600',
  secondary: 'bg-royal-600 text-white shadow-sm hover:bg-royal-700',
  outline: 'border border-royal-600 text-royal-600 hover:bg-royal-600 hover:text-white',
  cream: 'bg-cream-100 text-royal-700 hover:bg-white',
  'ghost-dark': 'text-royal-700 hover:text-magenta-600',
  soft: 'border border-royal-600/15 bg-white text-royal-700 shadow-sm hover:border-magenta-500 hover:text-magenta-600',
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
  return (
    <button type={type} className={classes} onClick={onClick} disabled={disabled} aria-label={ariaLabel}>
      {children}
    </button>
  )
}
