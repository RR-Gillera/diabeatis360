import { useMemo, useState } from 'react'

import { Button, Notice } from '../../components/ui'
import { accessRows, canReviewConversation, conversationLines } from '../../lib/conversationReview'
import { formatDate, formatDateTime } from '../../lib/format'
import { useFilteredCollection } from '../../lib/useCollection'
import { getConsultationNotes, recordOpening } from '../../services/conversationReview'

// Reported Issues drawer, conduct reports only (DECISIONS.md D58). The admin can read the chat and the doctor's notes of
// the ONE consultation the report is about, to investigate it. Opening them writes an Admin_Access_Log record first
// (firestore.rules refuses the chat without it), and every admin's openings are listed here, so nobody looks unseen.
// Read-only: nobody can change or delete a message or a note, admins included.
export default function ConversationReview({ report, admin }) {
  const [opened, setOpened] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notes, setNotes] = useState({ loading: false, data: null })

  const reviewable = canReviewConversation(report)
  // The chat is only asked for after the opening is recorded; asking earlier would be refused by the rules.
  const messages = useFilteredCollection('Messages', 'booking_id', opened ? report.bookingId : null)
  const logs = useFilteredCollection('Admin_Access_Log', 'booking_id', reviewable ? report.bookingId : null)

  const names = useMemo(() => ({
    [report.reporterId]: report.reporterName,
    ...(report.flagged ? { [report.flagged.id]: report.flagged.name } : {}),
  }), [report])
  const lines = conversationLines(messages.data, names)
  const records = accessRows(logs.data)

  if (!report.flagged) return null

  const open = async () => {
    setBusy(true)
    setError('')
    try {
      await recordOpening(report, admin.id)
      setOpened(true)
      // The notes are one document, read once; the chat above stays live.
      setNotes({ loading: true, data: null })
      setNotes({ loading: false, data: await getConsultationNotes(report.bookingId) })
    } catch (value) {
      setNotes({ loading: false, data: null })
      setError(value.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="rounded-2xl border border-gray-100 p-4">
      <p className="text-xs font-bold uppercase tracking-wide text-muted">Consultation chat and doctor&apos;s notes</p>

      {!reviewable ? (
        <p className="mt-2 text-muted">
          This report was sent before conversation review was added, so its chat cannot be opened. Ask the reporter for
          details instead.
        </p>
      ) : null}

      {reviewable && !opened ? (
        <div className="mt-2 flex flex-col gap-3">
          <p className="text-muted">
            To investigate this report you can read this consultation&apos;s chat and the doctor&apos;s notes. Only this
            consultation opens, and the opening is recorded under your name.
          </p>
          <div><Button variant="outline" className="!px-4 !py-2" disabled={busy} onClick={open}>{busy ? 'Opening…' : 'Open conversation'}</Button></div>
        </div>
      ) : null}

      {error ? <div className="mt-3"><Notice>{error}</Notice></div> : null}

      {opened ? (
        <div className="mt-3 flex flex-col gap-4">
          <div>
            <p className="mb-2 font-bold">Chat ({lines.length} {lines.length === 1 ? 'message' : 'messages'})</p>
            {messages.loading ? <p className="text-muted">Loading the chat…</p> : null}
            {messages.error ? <Notice>{messages.error}</Notice> : null}
            {!messages.loading && !messages.error && lines.length === 0 ? <p className="text-muted">No messages were sent in this consultation.</p> : null}
            {lines.length > 0 ? (
              <ol className="flex max-h-96 flex-col gap-2 overflow-y-auto rounded-2xl bg-gray-50 p-3">
                {lines.map((line) => (
                  <li key={line.id} className="rounded-xl bg-white px-3 py-2">
                    <p className="text-xs text-muted"><span className="font-bold text-gray-900">{line.who}</span> ({line.role}) · {formatDateTime(line.sentAt)}</p>
                    {line.text ? <p className="mt-1 whitespace-pre-wrap">{line.text}</p> : null}
                    {line.sharedTrend ? <p className="mt-1 text-xs italic text-muted">Shared a blood sugar chart.</p> : null}
                  </li>
                ))}
              </ol>
            ) : null}
          </div>

          <div>
            <p className="mb-2 font-bold">Doctor&apos;s notes</p>
            {notes.loading ? <p className="text-muted">Loading the notes…</p> : null}
            {!notes.loading && !notes.data ? <p className="text-muted">The doctor wrote no notes for this consultation.</p> : null}
            {notes.data ? (
              <dl className="grid grid-cols-3 gap-x-3 gap-y-2 rounded-2xl bg-gray-50 p-3">
                <dt className="text-muted">Diagnosis notes</dt><dd className="col-span-2 whitespace-pre-wrap">{notes.data.summary || '—'}</dd>
                {notes.data.advice ? (<><dt className="text-muted">Advice</dt><dd className="col-span-2 whitespace-pre-wrap">{notes.data.advice}</dd></>) : null}
                {notes.data.follow_up_at ? (<><dt className="text-muted">Follow-up</dt><dd className="col-span-2">{formatDate(notes.data.follow_up_at)}</dd></>) : null}
              </dl>
            ) : null}
          </div>
        </div>
      ) : null}

      {reviewable ? (
        <div className="mt-4 border-t border-gray-100 pt-3">
          <p className="text-xs font-bold uppercase tracking-wide text-muted">Access record</p>
          {records.length === 0 ? <p className="mt-1 text-muted">No admin has opened this consultation yet.</p> : (
            <ul className="mt-1 flex flex-col gap-1">
              {records.map((record) => (
                <li key={record.id} className="text-muted">
                  <span className="font-bold text-gray-900">{record.adminName}</span> opened it {record.count} {record.count === 1 ? 'time' : 'times'}, first {formatDateTime(record.firstOpenedAt)}, last {formatDateTime(record.lastOpenedAt)}
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  )
}
