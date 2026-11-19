import { collection, onSnapshot, query, where } from 'firebase/firestore'

import { db } from '../firebase'

// One generic live query, used by the read-only admin views (bookings, gamification, glucose, ...).
export function subscribeToCollection(name, onChange, onError) {
  return onSnapshot(
    collection(db, name),
    (snapshot) => onChange(snapshot.docs.map((document) => ({ id: document.id, ...document.data() }))),
    onError,
  )
}

/**
 * Just a live count of documents matching one equality filter — for sidebar badges (pending doctors,
 * pending guardians, unverified products). A filtered listener stays small even as the collection grows;
 * Firestore's count() aggregation reads (getCountFromServer) are not realtime, so a filtered onSnapshot is
 * the better fit here.
 */
export function subscribeToCount(name, field, value, onChange, onError) {
  return onSnapshot(query(collection(db, name), where(field, '==', value)), (snapshot) => onChange(snapshot.size), onError)
}

/** Live list of documents matching one equality filter — e.g. one patient's Glucose_Logs in the Users drawer. */
export function subscribeToQuery(name, field, value, onChange, onError) {
  return onSnapshot(
    query(collection(db, name), where(field, '==', value)),
    (snapshot) => onChange(snapshot.docs.map((document) => ({ id: document.id, ...document.data() }))),
    onError,
  )
}
