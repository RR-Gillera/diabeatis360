import { useState } from 'react'

import { useAuth } from '../../auth/AuthContext'
import DataTable from '../../components/DataTable'
import { TrashIcon } from '../../components/icons'
import { Button, Card, ConfirmDialog, Notice, SelectField, StatusBadge, TextArea, TextField } from '../../components/ui'
import { formatDate, toDate } from '../../lib/format'
import { useCollection } from '../../lib/useCollection'
import { audiences, deleteAnnouncement, publishAnnouncement, saveAnnouncementDraft } from '../../services/announcements'

const audienceLabel = Object.fromEntries(audiences.map((option) => [option.value, option.label]))
const emptyForm = { id: null, title: '', message: '', audience: 'all' }

// Send Announcements (module 8, admin) — FIGMA/ADMIN Settings > Announcements. "Publish Now" notifies every
// recipient (a Notifications doc each, shown in their app); "Save Draft" only stores it. Scheduled publishing and
// templates in the Figma are out of scope (decided 2026-09-29): a draft can be reopened and published later.
export default function AnnouncementsTab() {
  const { admin } = useAuth()
  const history = useCollection('Announcements')
  const [form, setForm] = useState(emptyForm)
  const [result, setResult] = useState(null)
  const [busy, setBusy] = useState(false)
  const [confirmingPublish, setConfirmingPublish] = useState(false)
  const [deleting, setDeleting] = useState(null)

  const rows = [...history.data].sort((a, b) => (toDate(b.published_at ?? b.created_at)?.getTime() ?? 0) - (toDate(a.published_at ?? a.created_at)?.getTime() ?? 0))

  const valid = () => {
    if (form.title.trim() && form.message.trim()) return true
    setResult({ tone: 'error', text: 'Please fill in all required fields.' })
    return false
  }

  const saveDraft = async () => {
    if (!valid()) return
    setBusy(true)
    setResult(null)
    try {
      await saveAnnouncementDraft(form, admin.id)
      setResult({ tone: 'success', text: 'Draft saved. Nobody was notified.' })
      setForm(emptyForm)
    } catch {
      setResult({ tone: 'error', text: 'We could not save the draft. Please try again.' })
    } finally {
      setBusy(false)
    }
  }

  const publish = async () => {
    setBusy(true)
    setResult(null)
    try {
      const count = await publishAnnouncement(form, admin.id)
      setResult({ tone: 'success', text: `Announcement sent to ${count} ${count === 1 ? 'user' : 'users'}.` })
      setForm(emptyForm)
    } catch {
      setResult({ tone: 'error', text: 'We could not send the announcement. Please try again.' })
    } finally {
      setBusy(false)
      setConfirmingPublish(false)
    }
  }

  const remove = async () => {
    setBusy(true)
    try {
      await deleteAnnouncement(deleting.id)
      if (form.id === deleting.id) setForm(emptyForm)
      setDeleting(null)
    } catch {
      setResult({ tone: 'error', text: 'We could not delete the announcement.' })
      setDeleting(null)
    } finally {
      setBusy(false)
    }
  }

  const columns = [
    {
      key: 'title',
      header: 'Title',
      render: (row) => (
        <div>
          <p className="font-bold">{row.title}</p>
          <p className="max-w-xs truncate text-xs text-muted">{row.message}</p>
        </div>
      ),
    },
    { key: 'audience', header: 'Audience', render: (row) => audienceLabel[row.audience] ?? row.audience },
    { key: 'date', header: 'Date', render: (row) => formatDate(row.published_at ?? row.created_at) },
    {
      key: 'status',
      header: 'Status',
      render: (row) => (row.status === 'published'
        ? <StatusBadge tone="success">Published · {row.recipient_count ?? 0}</StatusBadge>
        : <StatusBadge tone="warning">Draft</StatusBadge>),
    },
    {
      key: 'actions',
      header: 'Action',
      align: 'right',
      render: (row) => (
        <div className="flex items-center justify-end gap-3">
          {row.status === 'draft' ? (
            <button type="button" className="text-sm font-bold text-brand hover:underline" onClick={() => { setForm({ id: row.id, title: row.title, message: row.message, audience: row.audience }); setResult(null) }}>Edit</button>
          ) : null}
          <button type="button" aria-label={`Delete ${row.title}`} className="text-muted hover:text-red-600" onClick={() => setDeleting(row)}>
            <TrashIcon className="h-5 w-5" />
          </button>
        </div>
      ),
    },
  ]

  const audienceName = audienceLabel[form.audience]?.toLowerCase()

  return (
    <div>
      <h2 className="text-xl font-extrabold">Platform Announcements</h2>
      <p className="mb-4 text-sm text-muted">Communicate updates and health tips to your user base.</p>

      <Card className="mb-6">
        <h3 className="mb-4 text-lg font-extrabold">{form.id ? 'Edit Draft' : 'Create Announcement'}</h3>
        <div className="space-y-4">
          <TextField label="Announcement title" placeholder="e.g. New Feature Release" maxLength={80} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          <TextArea label="Announcement message" placeholder="Write your message here…" rows={5} maxLength={500} value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} />
          <SelectField label="Target audience" value={form.audience} onChange={(e) => setForm({ ...form, audience: e.target.value })}>
            {audiences.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </SelectField>
          {result ? <Notice tone={result.tone}>{result.text}</Notice> : null}
          <Button className="w-full" disabled={busy} onClick={() => { if (valid()) setConfirmingPublish(true) }}>Publish Now</Button>
          <Button variant="outline" className="w-full !border-gray-200 !text-muted hover:!bg-gray-50" disabled={busy} onClick={saveDraft}>Save Draft</Button>
          {form.id ? <Button variant="ghost" className="w-full" onClick={() => { setForm(emptyForm); setResult(null) }}>Cancel editing</Button> : null}
        </div>
      </Card>

      <h3 className="mb-3 text-lg font-extrabold">Previous Announcements</h3>
      {history.error ? <div className="mb-3"><Notice>{history.error}</Notice></div> : null}
      <DataTable columns={columns} rows={rows} pageSize={10} empty="No announcements yet. Published ones and drafts appear here." />

      <ConfirmDialog
        open={confirmingPublish}
        title="Publish announcement"
        message={`Send "${form.title.trim()}" to ${audienceName}? Each recipient gets it as a notification in their app, and this cannot be unsent.`}
        confirmLabel="Publish"
        busy={busy}
        onCancel={() => setConfirmingPublish(false)}
        onConfirm={publish}
      />
      <ConfirmDialog
        open={Boolean(deleting)}
        title="Delete announcement"
        message={`Delete "${deleting?.title}" from the history? Notifications already sent stay in users' inboxes.`}
        confirmLabel="Delete"
        danger
        busy={busy}
        onCancel={() => setDeleting(null)}
        onConfirm={remove}
      />
    </div>
  )
}
