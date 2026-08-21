import { useCallback, useEffect, useState } from 'react'
import { Megaphone, Plus, Pencil, Trash2, Send } from 'lucide-react'
import { api } from '@/lib/api'
import { useAuth } from '@/auth/AuthContext'
import { useToast } from '@/components/dashboard/Toast'
import { PageHeader } from '@/components/dashboard/PageHeader'
import { EmptyState } from '@/components/dashboard/States'
import { ConfirmDialog } from '@/components/dashboard/ConfirmDialog'
import { Modal } from '@/components/dashboard/Modal'
import type { AnnouncementView } from '@/types/portal'
import { cn } from '@/lib/cn'

const AUDIENCE_LABELS: Record<string, string> = {
  ALL: 'Everyone',
  ALL_STAFF: 'All Staff',
  TEACHING_STAFF: 'Teaching Staff',
  NON_TEACHING_STAFF: 'Non-Teaching Staff',
  PARENTS: 'Parents',
}

const AUDIENCE_KEYS = Object.keys(AUDIENCE_LABELS)

export function AnnouncementsPage() {
  const { hasPermission } = useAuth()
  const { push } = useToast()
  const canManage = hasPermission('announcements.manage')

  const [announcements, setAnnouncements] = useState<AnnouncementView[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [editing, setEditing] = useState<AnnouncementView | null>(null)
  const [deleting, setDeleting] = useState<AnnouncementView | null>(null)
  const [filterStatus, setFilterStatus] = useState('')

  const [formTitle, setFormTitle] = useState('')
  const [formBody, setFormBody] = useState('')
  const [formAudience, setFormAudience] = useState('ALL_STAFF')
  const [formStatus, setFormStatus] = useState<'DRAFT' | 'PUBLISHED'>('DRAFT')
  const [submitting, setSubmitting] = useState(false)

  const fetchAnnouncements = useCallback(async () => {
    try {
      setLoading(true)
      const params: { status?: string; limit?: number } = { limit: 50 }
      if (filterStatus) params.status = filterStatus
      const result = await api.listAnnouncements(params)
      setAnnouncements(result.items)
      setTotal(result.total)
    } catch {
      push('error', 'Failed to load announcements.')
    } finally {
      setLoading(false)
    }
  }, [filterStatus, push])

  useEffect(() => { fetchAnnouncements() }, [fetchAnnouncements])

  const resetForm = () => {
    setFormTitle('')
    setFormBody('')
    setFormAudience('ALL_STAFF')
    setFormStatus('DRAFT')
  }

  const handleCreate = async () => {
    if (!formTitle.trim() || !formBody.trim()) {
      push('error', 'Title and body are required.')
      return
    }
    try {
      setSubmitting(true)
      await api.createAnnouncement({
        title: formTitle.trim(),
        body: formBody.trim(),
        audience: formAudience as 'ALL' | 'ALL_STAFF' | 'TEACHING_STAFF' | 'NON_TEACHING_STAFF' | 'PARENTS',
        status: formStatus,
      })
      push('success', 'Announcement created.')
      resetForm()
      setShowCreateModal(false)
      fetchAnnouncements()
    } catch {
      push('error', 'Failed to create announcement.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleEdit = async () => {
    if (!editing || !formTitle.trim() || !formBody.trim()) return
    try {
      setSubmitting(true)
      await api.updateAnnouncement(editing.id, {
        title: formTitle.trim(),
        body: formBody.trim(),
        audience: formAudience as 'ALL' | 'ALL_STAFF' | 'TEACHING_STAFF' | 'NON_TEACHING_STAFF' | 'PARENTS',
        status: formStatus,
      })
      push('success', 'Announcement updated.')
      resetForm()
      setEditing(null)
      fetchAnnouncements()
    } catch {
      push('error', 'Failed to update announcement.')
    } finally {
      setSubmitting(false)
    }
  }

  const handlePublish = async (a: AnnouncementView) => {
    try {
      await api.updateAnnouncement(a.id, { status: 'PUBLISHED' })
      push('success', 'Announcement published.')
      fetchAnnouncements()
    } catch {
      push('error', 'Failed to publish.')
    }
  }

  const handleDelete = async () => {
    if (!deleting) return
    try {
      await api.deleteAnnouncement(deleting.id)
      push('success', 'Announcement deleted.')
      setDeleting(null)
      fetchAnnouncements()
    } catch {
      push('error', 'Failed to delete.')
    }
  }

  const openEdit = (a: AnnouncementView) => {
    setFormTitle(a.title)
    setFormBody(a.body)
    setFormAudience(a.audience)
    setFormStatus(a.status as 'DRAFT' | 'PUBLISHED')
    setEditing(a)
  }

  const AnnouncementForm = ({ onSave, saveLabel }: { onSave: () => void; saveLabel: string }) => (
    <div className="space-y-4">
      <div>
        <label htmlFor="ann-title" className="block text-sm font-semibold text-ink-700">Title</label>
        <input id="ann-title" value={formTitle} onChange={(e) => setFormTitle(e.target.value)}
          className="mt-1 w-full rounded-xl border border-cream-300 bg-white px-3 py-2.5 text-sm text-ink-900 focus:border-royal-500 focus:outline-none focus:ring-1 focus:ring-royal-500" />
      </div>
      <div>
        <label htmlFor="ann-body" className="block text-sm font-semibold text-ink-700">Body</label>
        <textarea id="ann-body" rows={5} value={formBody} onChange={(e) => setFormBody(e.target.value)}
          className="mt-1 w-full rounded-xl border border-cream-300 bg-white px-3 py-2.5 text-sm text-ink-900 focus:border-royal-500 focus:outline-none focus:ring-1 focus:ring-royal-500" />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="ann-audience" className="block text-sm font-semibold text-ink-700">Audience</label>
          <select id="ann-audience" value={formAudience} onChange={(e) => setFormAudience(e.target.value)}
            className="mt-1 w-full rounded-xl border border-cream-300 bg-white px-3 py-2.5 text-sm text-ink-900 focus:border-royal-500 focus:outline-none focus:ring-1 focus:ring-royal-500">
            {AUDIENCE_KEYS.map((k) => <option key={k} value={k}>{AUDIENCE_LABELS[k]}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="ann-status" className="block text-sm font-semibold text-ink-700">Status</label>
          <select id="ann-status" value={formStatus} onChange={(e) => setFormStatus(e.target.value as 'DRAFT' | 'PUBLISHED')}
            className="mt-1 w-full rounded-xl border border-cream-300 bg-white px-3 py-2.5 text-sm text-ink-900 focus:border-royal-500 focus:outline-none focus:ring-1 focus:ring-royal-500">
            <option value="DRAFT">Draft</option>
            <option value="PUBLISHED">Published</option>
          </select>
        </div>
      </div>
      <div className="flex justify-end gap-3 pt-2">
        <button type="button" onClick={() => { resetForm(); setShowCreateModal(false); setEditing(null) }}
          className="rounded-xl border border-cream-300 px-4 py-2 text-sm font-semibold text-ink-700 hover:bg-cream-100">Cancel</button>
        <button type="button" onClick={onSave} disabled={submitting}
          className="rounded-xl bg-royal-600 px-4 py-2 text-sm font-semibold text-white hover:bg-royal-700 disabled:opacity-50">
          {submitting ? 'Saving...' : saveLabel}
        </button>
      </div>
    </div>
  )

  return (
    <div className="space-y-6">
      <PageHeader
        title="Announcements"
        description={`${total} announcement${total !== 1 ? 's' : ''}`}
        actions={canManage ? (
          <button type="button" onClick={() => { resetForm(); setShowCreateModal(true) }}
            className="inline-flex items-center gap-2 rounded-xl bg-royal-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-royal-700">
            <Plus className="h-4 w-4" aria-hidden="true" /> New Announcement
          </button>
        ) : undefined}
      />

      {canManage && (
        <div className="flex items-center gap-3">
          <label htmlFor="status-filter" className="text-sm font-semibold text-ink-700">Status:</label>
          <select id="status-filter" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}
            className="rounded-xl border border-cream-300 bg-white px-3 py-2 text-sm text-ink-900 focus:border-royal-500 focus:outline-none focus:ring-1 focus:ring-royal-500">
            <option value="">All</option>
            <option value="DRAFT">Draft</option>
            <option value="PUBLISHED">Published</option>
          </select>
        </div>
      )}

      {loading ? (
        <div className="rounded-2xl border border-cream-300/70 bg-white p-8 text-center shadow-sm">
          <p className="text-sm text-ink-500">Loading announcements...</p>
        </div>
      ) : announcements.length === 0 ? (
        <EmptyState icon={<Megaphone className="h-12 w-12" />} title="No announcements found." />
      ) : (
        <div className="space-y-3">
          {announcements.map((a) => (
            <div key={a.id} className={cn(
              'rounded-2xl border border-cream-300/70 bg-white p-5 shadow-sm',
              a.status === 'DRAFT' && 'border-l-4 border-l-gold-400',
            )}>
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold text-ink-900">{a.title}</h3>
                    <span className={cn(
                      'rounded-full px-2 py-0.5 text-[10px] font-bold uppercase',
                      a.status === 'PUBLISHED' ? 'bg-emerald-100 text-emerald-700' : 'bg-gold-100 text-gold-700',
                    )}>{a.status}</span>
                  </div>
                  <p className="mt-1 line-clamp-3 text-sm text-ink-600">{a.body}</p>
                  <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-ink-500">
                    <span>Audience: {AUDIENCE_LABELS[a.audience] ?? a.audience}</span>
                    <span>By {a.createdByName}</span>
                    <span>{new Date(a.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>
                {canManage && (
                  <div className="flex shrink-0 items-center gap-1">
                    {a.status === 'DRAFT' && (
                      <button type="button" onClick={() => handlePublish(a)}
                        className="rounded-lg p-2 text-emerald-600 transition-colors hover:bg-emerald-50" title="Publish">
                        <Send className="h-4 w-4" />
                      </button>
                    )}
                    <button type="button" onClick={() => openEdit(a)}
                      className="rounded-lg p-2 text-royal-600 transition-colors hover:bg-royal-50" title="Edit">
                      <Pencil className="h-4 w-4" />
                    </button>
                    {a.status === 'DRAFT' && (
                      <button type="button" onClick={() => setDeleting(a)}
                        className="rounded-lg p-2 text-red-600 transition-colors hover:bg-red-50" title="Delete">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {showCreateModal && (
        <Modal open={showCreateModal} onClose={() => { setShowCreateModal(false); resetForm() }} title="New Announcement">
          <AnnouncementForm onSave={handleCreate} saveLabel="Create" />
        </Modal>
      )}

      {editing && (
        <Modal open={!!editing} onClose={() => { setEditing(null); resetForm() }} title="Edit Announcement">
          <AnnouncementForm onSave={handleEdit} saveLabel="Update" />
        </Modal>
      )}

      {deleting && (
        <ConfirmDialog
          open={!!deleting}
          title="Delete Announcement"
          message={`Are you sure you want to delete "${deleting.title}"? This cannot be undone.`}
          confirmLabel="Delete"
          onConfirm={handleDelete}
          onCancel={() => setDeleting(null)}
        />
      )}
    </div>
  )
}
