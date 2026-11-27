import { addDoc, collection, doc, onSnapshot, serverTimestamp, updateDoc } from 'firebase/firestore'

import { db } from '../firebase'

// Doctor Management (Table 24, module 10). A doctor's Providers doc ID is their Auth UID.
// Firestore rules let only an admin change is_verified, verified_by, is_active, rejection_reason,
// reviewed_by, reviewed_at, (once) created_by_admin, and give `credentials` a value (D55).

export function subscribeToDoctors(onChange, onError) {
  return onSnapshot(
    collection(db, 'Providers'),
    (snapshot) => onChange(snapshot.docs.map((document) => ({ id: document.id, ...document.data() }))),
    onError,
  )
}

/**
 * The doctor's profile photo (D54): Profile_Photos/{uid}.photo is a small JPEG saved as a "data:" address, which an
 * <img> shows directly. onChange gets null when the doctor has not added one yet.
 */
export function subscribeToProfilePhoto(uid, onChange) {
  return onSnapshot(
    doc(db, 'Profile_Photos', uid),
    (snapshot) => onChange(snapshot.exists() ? String(snapshot.data().photo ?? '') || null : null),
    () => onChange(null),
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

// The credentials a doctor shows after their name, e.g. "Dr. Juan Dela Cruz, MD, FPCP" (DECISIONS.md D55 part 1).
// The doctor asks in the app (credentials_requested); patients see only `credentials`, which only these functions
// fill. firestore.rules lets an admin approve exactly the doctor's request, never a title the admin typed.

/** Approve: the requested text becomes what patients see, and the request is cleared. */
export function approveCredentials(doctorId, requested) {
  return updateDoc(doc(db, 'Providers', doctorId), {
    credentials: requested,
    credentials_requested: '',
    credentials_rejection_reason: '',
  })
}

/** Reject, with a reason the doctor sees under the field in Edit Profile. The request stays, so they can correct it. */
export function rejectCredentials(doctorId, reason) {
  return updateDoc(doc(db, 'Providers', doctorId), { credentials_rejection_reason: reason.trim() })
}

/** Remove an approved suffix that turns out to be false. Patients stop seeing it at once. */
export function removeCredentials(doctorId) {
  return updateDoc(doc(db, 'Providers', doctorId), { credentials: '' })
}

/** Tells the doctor what happened to their credentials (shown in their Inbox and Recent Activity). */
export function notifyCredentialsDecision(doctorId, outcome, credentials, reason) {
  const quoted = credentials ? ` "${credentials}"` : ''
  const why = reason ? `: ${reason.trim()}` : ''
  const message = {
    approved: `Your credentials${quoted} were approved. Patients now see them after your name.`,
    rejected: `Your credentials${quoted} were not approved${why}. You can change them in Edit Profile and ask again.`,
    removed: `Your credentials${quoted} were removed from your name${why}.`,
  }[outcome]
  return addDoc(collection(db, 'Notifications'), {
    user_id: doctorId,
    notification_type: 'doctor_verification',
    message,
    severity: outcome === 'approved' ? 'info' : 'warning',
    is_read: false,
    related_id: '',
    scheduled_time: serverTimestamp(),
    sent_at: serverTimestamp(),
  })
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
