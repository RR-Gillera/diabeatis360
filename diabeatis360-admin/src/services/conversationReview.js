import { doc, getDoc, increment, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore'

import { db } from '../firebase'
import { accessLogId } from '../lib/conversationReview'

// Reviewing a reported consultation (DECISIONS.md D58). firestore.rules lets an admin read a booking's Messages and
// Consultation_Notes only after this admin has an Admin_Access_Log record for that booking, and that record can only be
// made for a booking whose patient or doctor reported the other. So the record is written FIRST, then the chat is read.

/**
 * Records that this admin is opening the reported consultation: the first time a new record, after that one more count.
 * `report` is a row from lib/reportedIssues.js issueRows (id, bookingId).
 */
export async function recordOpening(report, adminId) {
  const ref = doc(db, 'Admin_Access_Log', accessLogId(report.bookingId, adminId))
  const existing = await getDoc(ref)
  if (existing.exists()) {
    await updateDoc(ref, { report_id: report.id, last_opened_at: serverTimestamp(), open_count: increment(1) })
    return
  }
  // The rules check admin_name against the admin's own Admins record, so read it fresh (the name may have been edited
  // in My Account since this page loaded).
  const me = await getDoc(doc(db, 'Admins', adminId))
  await setDoc(ref, {
    admin_id: adminId,
    admin_name: me.data()?.full_name ?? '',
    booking_id: report.bookingId,
    report_id: report.id,
    first_opened_at: serverTimestamp(),
    last_opened_at: serverTimestamp(),
    open_count: 1,
  })
}

/** The doctor's notes of the consultation (Consultation_Notes/{bookingId}), or null when the doctor wrote none. */
export async function getConsultationNotes(bookingId) {
  const snapshot = await getDoc(doc(db, 'Consultation_Notes', bookingId))
  return snapshot.exists() ? snapshot.data() : null
}
