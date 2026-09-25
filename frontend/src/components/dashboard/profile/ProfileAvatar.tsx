import { useRef } from 'react'
import type { ChangeEvent } from 'react'
import { Camera, Trash2 } from 'lucide-react'
import { Avatar } from '@/components/dashboard/Avatar'
import { Spinner } from '@/components/dashboard/Loaders'

interface ProfileAvatarProps {
  name: string
  imageUrl?: string | null
  uploading?: boolean
  deleting?: boolean
  /** When provided, renders the upload/change/remove photo controls. */
  onUpload?: (file: File) => void
  onRemove?: () => void
}

/**
 * Profile avatar backed by the existing profile-picture infrastructure
 * (`POST/DELETE /api/profile-picture`). Without `onUpload` it renders a plain
 * initials/photo avatar for accounts that have no upload capability.
 */
export function ProfileAvatar({
  name,
  imageUrl = null,
  uploading = false,
  deleting = false,
  onUpload,
  onRemove,
}: ProfileAvatarProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)

  if (!onUpload) {
    return <Avatar name={name} imageUrl={imageUrl} size="xl" className="ring-4 ring-cream-300/80" />
  }

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (file) onUpload(file)
  }

  return (
    <div className="flex flex-col items-center gap-3 sm:items-start">
      <div className="relative">
        <Avatar
          name={name}
          imageUrl={imageUrl}
          size="xl"
          className={
            uploading ? 'opacity-50 ring-4 ring-cream-300/80' : 'ring-4 ring-cream-300/80'
          }
        />
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          className="hidden"
          onChange={handleChange}
          aria-label="Choose a profile picture file"
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="absolute -bottom-1 -right-1 flex h-10 w-10 items-center justify-center rounded-full border-2 border-white bg-magenta-500 text-white shadow-md transition-colors hover:bg-magenta-600 disabled:cursor-not-allowed disabled:opacity-50"
          aria-label="Change profile picture"
        >
          {uploading ? (
            <Spinner className="h-4 w-4" />
          ) : (
            <Camera className="h-4 w-4" aria-hidden="true" />
          )}
        </button>
      </div>
      <div className="flex flex-col items-center gap-1 text-center sm:items-start sm:text-left">
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="text-sm font-bold text-royal-700 underline-offset-2 transition-colors hover:text-magenta-600 hover:underline disabled:cursor-not-allowed disabled:opacity-50"
        >
          {uploading ? 'Uploading…' : imageUrl ? 'Change Photo' : 'Upload Photo'}
        </button>
        <p className="text-xs text-ink-500">JPG, PNG, WebP or GIF / Maximum 5 MB</p>
        {imageUrl && onRemove ? (
          <button
            type="button"
            onClick={onRemove}
            disabled={deleting}
            className="mt-1 inline-flex items-center gap-1.5 text-xs font-semibold text-red-600 transition-colors hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {deleting ? (
              <Spinner className="h-3.5 w-3.5" />
            ) : (
              <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
            )}
            Remove Photo
          </button>
        ) : null}
      </div>
    </div>
  )
}
