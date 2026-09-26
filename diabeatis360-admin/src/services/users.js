import { collection, doc, onSnapshot, updateDoc } from 'firebase/firestore'

import { db } from '../firebase'

// User management (manuscript web tests UT-A003 to UT-A005). Users/{uid} exists for patients AND doctors.

export function subscribeToUsers(onChange, onError) {
  return onSnapshot(
    collection(db, 'Users'),
    (snapshot) => onChange(snapshot.docs.map((document) => ({ id: document.id, ...document.data() }))),
    onError,
  )
}

/** Accounts are deactivated, never deleted, so bookings and glucose logs stay intact. */
export function setUserActive(userId, active) {
  return updateDoc(doc(db, 'Users', userId), { is_active: active })
}
