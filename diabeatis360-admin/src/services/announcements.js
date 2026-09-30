import { addDoc, collection, deleteDoc, doc, getDocs, serverTimestamp, setDoc, writeBatch } from 'firebase/firestore'

import { db } from '../firebase'

// Send Announcements (module 8, admin), with the history + drafts FIGMA/ADMIN Settings page shows.
// Publishing fans out one Notifications doc per recipient, which the mobile apps already show in their
// notification lists. Deactivated accounts are skipped. A draft is saved but never fanned out.
export const audiences = [
  { value: 'all', label: 'Everyone (patients and doctors)' },
  { value: 'patient', label: 'Patients only' },
  { value: 'doctor', label: 'Doctors only' },
]

async function fanOut(title, message, audience) {
  const users = await getDocs(collection(db, 'Users'))
  const recipients = users.docs.filter((document) => {
    const data = document.data()
    if (data.is_active === false) return false
    if (audience === 'doctor') return data.role === 'doctor'
    if (audience === 'patient') return data.role === 'patient' // D9: Users holds both roles
    return true
  })

  const text = `${title.trim()}: ${message.trim()}`
  // Firestore allows at most 500 writes per batch.
  for (let start = 0; start < recipients.length; start += 400) {
    const batch = writeBatch(db)
    recipients.slice(start, start + 400).forEach((recipient) => {
      batch.set(doc(collection(db, 'Notifications')), {
        user_id: recipient.id,
        notification_type: 'announcement',
        message: text,
        severity: 'info',
        is_read: false,
        related_id: '',
        scheduled_time: serverTimestamp(),
        sent_at: serverTimestamp(),
      })
    })
    await batch.commit()
  }
  return recipients.length
}

/** Save Draft: stored in the history table as DRAFT, nobody is notified yet. Passing `id` updates that draft. */
export async function saveAnnouncementDraft({ id, title, message, audience }, adminId) {
  const fields = { title: title.trim(), message: message.trim(), audience, status: 'draft' }
  if (id) {
    await setDoc(doc(db, 'Announcements', id), fields, { merge: true })
    return id
  }
  const reference = await addDoc(collection(db, 'Announcements'), {
    ...fields,
    recipient_count: 0,
    created_by: adminId,
    created_at: serverTimestamp(),
  })
  return reference.id
}

/** Publish Now: creates (or promotes an existing draft into) a PUBLISHED history row and notifies everyone. */
export async function publishAnnouncement({ id, title, message, audience }, adminId) {
  const recipientCount = await fanOut(title, message, audience)
  const payload = {
    title: title.trim(),
    message: message.trim(),
    audience,
    status: 'published',
    recipient_count: recipientCount,
    created_by: adminId,
    published_at: serverTimestamp(),
  }
  if (id) {
    await setDoc(doc(db, 'Announcements', id), payload, { merge: true })
  } else {
    await addDoc(collection(db, 'Announcements'), { ...payload, created_at: serverTimestamp() })
  }
  return recipientCount
}

export function deleteAnnouncement(id) {
  return deleteDoc(doc(db, 'Announcements', id))
}
