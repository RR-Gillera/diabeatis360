import { collection, doc, getDocs, serverTimestamp, writeBatch } from 'firebase/firestore'

import { db } from '../firebase'

// Send Announcements (module 8, admin). Fan-out: one Notifications doc per recipient, which the mobile
// apps already show in their notification lists. Deactivated accounts are skipped.
export const audiences = [
  { value: 'all', label: 'Everyone (patients and doctors)' },
  { value: 'patient', label: 'Patients only' },
  { value: 'doctor', label: 'Doctors only' },
]

export async function sendAnnouncement({ title, message, audience }) {
  const users = await getDocs(collection(db, 'Users'))
  const recipients = users.docs.filter((document) => {
    const data = document.data()
    if (data.is_active === false) return false
    if (audience === 'doctor') return data.role === 'doctor'
    if (audience === 'patient') return data.role !== 'doctor'
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
