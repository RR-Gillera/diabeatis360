import { collection, doc, onSnapshot, updateDoc } from 'firebase/firestore'

import { db } from '../firebase'

// Doctor Management (Table 24, module 10). A doctor's Providers doc ID is their Auth UID.
// Firestore rules let only an admin change is_verified, verified_by and is_active.

export function subscribeToDoctors(onChange, onError) {
  return onSnapshot(
    collection(db, 'Providers'),
    (snapshot) => onChange(snapshot.docs.map((document) => ({ id: document.id, ...document.data() }))),
    onError,
  )
}

/** Verify Doctor Credentials: records who verified, so the panel can show it. */
export function verifyDoctor(doctorId, adminId) {
  return updateDoc(doc(db, 'Providers', doctorId), { is_verified: true, verified_by: adminId })
}

/** Activate or Deactivate Doctor. A deactivated doctor is signed out of the mobile app and hidden from the directory. */
export function setDoctorActive(doctorId, active) {
  return updateDoc(doc(db, 'Providers', doctorId), { is_active: active })
}
