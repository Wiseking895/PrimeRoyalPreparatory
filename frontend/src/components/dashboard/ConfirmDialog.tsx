import { AlertTriangle } from 'lucide-react'
import { useState } from 'react'
import type { ReactNode } from 'react'
import { Modal } from '@/components/dashboard/Modal'

interface ConfirmDialogProps {
  open: boolean
  title: string
  message: ReactNode
  confirmLabel?: string
  cancelLabel?: string
  loading?: boolean
  onConfirm: () => void
  onCancel: () => void
}

/** Accessible confirmation dialog reserved for destructive state changes. */
export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  loading = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const [confirmed, setConfirmed] = useState(false)

  return (
    <Modal open={open} onClose={loading ? () => undefined : onCancel} title={title}>
      <div className="flex items-start gap-4">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-red-100 text-red-600">
          <AlertTriangle className="h-5 w-5" aria-hidden="true" />
        </span>
        <div className="flex-1">
          <div className="text-sm leading-relaxed text-ink-700">{message}</div>
          <label className="mt-4 flex items-start gap-2.5 text-sm text-ink-700">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(event) => setConfirmed(event.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-cream-300 text-magenta-600 focus:ring-magenta-500"
            />
            I understand this action is significant and confirm it.
          </label>
          <div className="mt-5 flex flex-wrap justify-end gap-2">
            <button
              type="button"
              onClick={onCancel}
              disabled={loading}
              className="rounded-full px-5 py-2.5 text-sm font-semibold text-ink-700 transition-colors hover:bg-cream-100"
            >
              {cancelLabel}
            </button>
            <button
              type="button"
              onClick={onConfirm}
              disabled={!confirmed || loading}
              className="rounded-full bg-red-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? 'Working…' : confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </Modal>
  )
}