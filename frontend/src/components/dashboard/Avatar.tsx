import { cn } from '@/lib/cn'

interface AvatarProps {
  name: string
  imageUrl?: string | null
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const sizes = {
  sm: 'h-9 w-9 text-xs',
  md: 'h-11 w-11 text-sm',
  lg: 'h-16 w-16 text-lg',
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('')
}

/**
 * Avatar with an initials fallback. Profile pictures follow the existing asset
 * strategy — the API carries a `profilePictureUrl`; when absent we render a
 * branded initials block instead of a broken image.
 */
export function Avatar({ name, imageUrl = null, size = 'md', className }: AvatarProps) {
  const classes = cn(
    'inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full font-bold',
    sizes[size],
    imageUrl ? 'bg-white' : 'bg-royal-600 text-white',
    className,
  )

  if (imageUrl) {
    return <img src={imageUrl} alt={name} className={classes + ' object-cover'} />
  }

  return (
    <span className={classes} aria-hidden="true">
      {initials(name)}
    </span>
  )
}