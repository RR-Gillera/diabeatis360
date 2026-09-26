import { useState } from 'react'

import { Button, Card, Notice, PageHeader, TextField } from '../components/ui'
import { audiences, sendAnnouncement } from '../services/announcements'

// Send Announcements (module 8, admin): the message shows up in each recipient's in-app notification list.
export default function AnnouncementsPage() {
  const [title, setTitle] = useState('')
  const [message, setMessage] = useState('')
  const [audience, setAudience] = useState('all')
  const [result, setResult] = useState(null)
  const [busy, setBusy] = useState(false)

  const send = async (event) => {
    event.preventDefault()
    if (!title.trim() || !message.trim()) {
      setResult({ tone: 'error', text: 'Please fill in all required fields.' })
      return
    }
    setBusy(true)
    setResult(null)
    try {
      const count = await sendAnnouncement({ title, message, audience })
      setResult({ tone: 'success', text: `Announcement sent to ${count} ${count === 1 ? 'user' : 'users'}.` })
      setTitle('')
      setMessage('')
    } catch {
      setResult({ tone: 'error', text: 'We could not send the announcement. Please try again.' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="max-w-2xl">
      <PageHeader title="Announcements" subtitle="Send a notice to app users. It appears in their notification list." />
      <Card>
        <form onSubmit={send} className="space-y-4" noValidate>
          <TextField label="Title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={80} />
          <label className="block text-sm font-medium text-ink">
            Message
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={5}
              maxLength={500}
              className="mt-1 w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm outline-none focus:border-brand"
            />
          </label>
          <label className="block text-sm font-medium text-ink">
            Send to
            <select
              value={audience}
              onChange={(e) => setAudience(e.target.value)}
              className="mt-1 w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm outline-none focus:border-brand"
            >
              {audiences.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </label>
          {result ? <Notice tone={result.tone}>{result.text}</Notice> : null}
          <Button type="submit" disabled={busy}>{busy ? 'Sending…' : 'Send announcement'}</Button>
        </form>
      </Card>
    </div>
  )
}
