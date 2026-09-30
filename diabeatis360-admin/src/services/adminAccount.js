import { doc, getDoc, serverTimestamp, updateDoc } from 'firebase/firestore'
import {
  browserLocalPersistence,
  browserSessionPersistence,
  sendPasswordResetEmail,
  setPersistence,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
} from 'firebase/auth'

import { auth, db } from '../firebase'

// Pages never call Firestore or Auth directly; they call a function from a service file like this one.
// Role model (docs/DECISIONS.md D9): an admin is anyone with a document in Admins/{uid}.

/** The Admins/{uid} document as a plain object, or null if this Auth user is not an admin. */
export async function fetchAdminProfile(uid) {
  const snapshot = await getDoc(doc(db, 'Admins', uid))
  return snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : null
}

/**
 * "Keep me logged in" (FIGMA/ADMIN login checkbox): local persistence survives closing the browser tab;
 * session persistence (the default) clears when the browser session ends. Must be set before sign-in.
 */
export async function signInAdmin(email, password, remember) {
  await setPersistence(auth, remember ? browserLocalPersistence : browserSessionPersistence)
  return signInWithEmailAndPassword(auth, email.trim(), password)
}

export function signOutAdmin() {
  return signOut(auth)
}

export function sendAdminPasswordReset(email) {
  return sendPasswordResetEmail(auth, email.trim())
}

/** Best effort: a failure here must never stop a valid admin from signing in. */
export async function recordAdminLogin(uid) {
  try {
    await updateDoc(doc(db, 'Admins', uid), { last_login: serverTimestamp() })
  } catch {
    // Ignored on purpose.
  }
}

/** Update Account: the admin's display name, kept on both the Auth user and the Admins document. */
export async function updateAdminName(uid, fullName) {
  const name = fullName.trim()
  await updateProfile(auth.currentUser, { displayName: name })
  await updateDoc(doc(db, 'Admins', uid), { full_name: name })
  return name
}
