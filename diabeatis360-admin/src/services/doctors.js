import { addDoc, collection, doc, onSnapshot, serverTimestamp, updateDoc } from 'firebase/firestore'

import { db } from '../firebase'

// Doctor Management (Table 24, module 10). A doctor's Providers doc ID is their Auth UID.
// Firestore rules let only an admin change is_verified, verified_by, is_active, rejection_reason,
// reviewed_by, reviewed_at and (once) created_by_admin.

export function subscribeToDoctors(onChange, onError) {
  return onSnapshot(
    collection(db, 'Providers'),
    (snapshot) => onChange(snapshot.docs.map((document) => ({ id: document.id, ...document.data() }))),
    onError,
  )
}

/** Verify Doctor Credentials: records who verified, clears any earlier rejection note. */
export function verifyDoctor(doctorId, adminId) {
  return updateDoc(doc(db, 'Providers', doctorId), {
    is_verified: true,
    verified_by: adminId,
    rejection_reason: '',
    reviewed_by: adminId,
    reviewed_at: serverTimestamp(),
  })
}

/** Reject Doctor Credentials, with a reason the doctor sees on their pending-verification screen. */
export function rejectDoctor(doctorId, adminId, reason) {
  return updateDoc(doc(db, 'Providers', doctorId), {
    is_verified: false,
    rejection_reason: reason.trim(),
    reviewed_by: adminId,
    reviewed_at: serverTimestamp(),
  })
}

/** Activate or Deactivate Doctor. A deactivated doctor is signed out of the mobile app and hidden from the directory. */
export function setDoctorActive(doctorId, active) {
  return updateDoc(doc(db, 'Providers', doctorId), { is_active: active })
}

/** Tells the doctor's own account what happened, the same pattern as guardians.js notifyGuardianDecision. */
export function notifyDoctorDecision(doctorId, approved, reason) {
  return addDoc(collection(db, 'Notifications'), {
    user_id: doctorId,
    notification_type: 'doctor_verification',
    message: approved
      ? 'Your PRC credentials were verified. Your profile is now visible to patients.'
      : `Your credentials need a fix before they can be verified${reason ? `: ${reason.trim()}` : ''}.`,
    severity: approved ? 'info' : 'warning',
    is_read: false,
    related_id: '',
    scheduled_time: serverTimestamp(),
    sent_at: serverTimestamp(),
  })
}
