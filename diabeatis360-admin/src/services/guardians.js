import { addDoc, collection, doc, serverTimestamp, updateDoc } from 'firebase/firestore'

import { db } from '../firebase'

// Pediatric accounts under guardian supervision (DECISIONS.md D16; manuscript Scope & Limitations, UT-005).
// The Guardian_Verifications doc id IS the child's own Auth UID. Firestore rules let only an admin change
// verification_status, reviewed_by, reviewed_at and rejection_reason.

export function approveGuardian(childUid, adminId) {
  return updateDoc(doc(db, 'Guardian_Verifications', childUid), {
    verification_status: 'approved',
    reviewed_by: adminId,
    reviewed_at: serverTimestamp(),
  })
}

export function rejectGuardian(childUid, adminId, reason) {
  return updateDoc(doc(db, 'Guardian_Verifications', childUid), {
    verification_status: 'rejected',
    reviewed_by: adminId,
    reviewed_at: serverTimestamp(),
    rejection_reason: reason.trim(),
  })
}

/** Tells the child's account what happened, the same way DoctorsPage / AnnouncementsPage notify people. */
export function notifyGuardianDecision(childUid, approved, reason) {
  return addDoc(collection(db, 'Notifications'), {
    user_id: childUid,
    notification_type: 'guardian_verification',
    message: approved
      ? 'Your guardian verification was approved. You can now book a consultation.'
      : `Your guardian verification was not approved${reason ? `: ${reason.trim()}` : ''}. You can resubmit it from Profile.`,
    severity: approved ? 'info' : 'warning',
    is_read: false,
    related_id: '',
    scheduled_time: serverTimestamp(),
    sent_at: serverTimestamp(),
  })
}
