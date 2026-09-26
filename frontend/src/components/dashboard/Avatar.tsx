import { useEffect, useState } from 'react'
import { cn } from '@/lib/cn'
import { api } from '@/lib/api'
import { isDocumentReference } from '@/lib/document-reference'

interface AvatarProps {
  name: string
  imageUrl?: string | null
  size?: 'sm' | 'md' | 'lg' | 'xl'
  className?: string
}

const sizes = {
  sm: 'h-9 w-9 text-xs',
  md: 'h-11 w-11 text-sm',
  lg: 'h-16 w-16 text-lg',
  xl: 'h-24 w-24 text-2xl sm:h-28 sm:w-28 sm:text-3xl',
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
 * strategy — the API carries a `profilePictureUrl`. Object-store pictures are
 * referenced as `/api/documents/{id}` (private bucket); those are resolved to
 * a short-lived presigned URL through the API, and until (or unless) that
 * succeeds we render the branded initials block instead of a broken image.
 * Legacy `/api/uploads/...` and absolute URLs are used as-is.
 */
export function Avatar({ name, imageUrl = null, size = 'md', className }: AvatarProps) {
  const needsResolution = isDocumentReference(imageUrl)
  const [resolvedUrl, setResolvedUrl] = useState<string | null>(null)

  useEffect(() => {
    if (!needsResolution || !imageUrl) {
      setResolvedUrl(null)
      return
    }
    let active = true
    api
      .resolveDocumentUrl(imageUrl)
      .then((url) => {
        if (active) setResolvedUrl(url)
      })
      .catch(() => {
        if (active) setResolvedUrl(null)
      })
    return () => {
      active = false
    }
  }, [imageUrl, needsResolution])

  const src = needsResolution ? resolvedUrl : imageUrl

  const classes = cn(
    'inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full font-bold',
    sizes[size],
    src ? 'bg-white' : 'bg-royal-600 text-white',
    className,
  )

  if (src) {
    return <img src={src} alt={name} className={classes + ' object-cover'} />
  }

  return (
    <span className={classes} aria-hidden="true">
      {initials(name)}
    </span>
  )
}
