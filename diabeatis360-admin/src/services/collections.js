import { collection, onSnapshot } from 'firebase/firestore'

import { db } from '../firebase'

// One generic live query, used by the read-only admin views (bookings, gamification, glucose, ...).
export function subscribeToCollection(name, onChange, onError) {
  return onSnapshot(
    collection(db, name),
    (snapshot) => onChange(snapshot.docs.map((document) => ({ id: document.id, ...document.data() }))),
    onError,
  )
}
