import { deleteApp, initializeApp } from 'firebase/app'
import { connectAuthEmulator, createUserWithEmailAndPassword, getAuth, sendPasswordResetEmail, signOut } from 'firebase/auth'
import { connectFirestoreEmulator, doc, getFirestore, serverTimestamp, updateDoc, writeBatch } from 'firebase/firestore'

import { auth, db, firebaseConfig, usingEmulators } from '../firebase'
import { feeProblem, storedFee } from '../lib/fee'

// UT-A006 "Add Provider": an admin creates a doctor's login from the browser without ever touching their
// own admin session. The Firebase JS SDK signs in whoever you last created or signed in on an app instance,
// so doing this on the *primary* app would silently replace the admin's own session. Instead we open a
// second, throwaway Firebase app (same project, its own in-memory Auth instance), create the doctor there,
// write their Firestore docs as that new user (already allowed by the "create your own profile" rules), then
// tear the whole throwaway app down. The admin's own session on the primary app is never touched.
//
// Safeguards (see docs/IMPLEMENTATION_PLAN.md "UT-A006 safeguards"):
//   - The temporary password is random, held only in a local variable, and never shown, logged, or stored.
//   - The doctor sets their real password via a password-reset email sent right after the account is made.
//   - `created_by_admin` on the Providers doc is the audit trail for the defense.
//   - The fee is checked before anything is created (QA ADM-005: a fee of -100 used to be saved and verified).
//   - The Users and Providers documents are written in ONE batch, so either both exist or neither does (a refused
//     Providers write, for example a fee firestore.rules does not accept, used to leave a Users doc behind).
//   - If that batch fails after the Auth user exists, that Auth user is deleted before we give up,
//     so a half-created login is never left behind.

function randomPassword() {
  const bytes = crypto.getRandomValues(new Uint8Array(24))
  return `${btoa(String.fromCharCode(...bytes)).replace(/[+/=]/g, '')}aA1!` // satisfies any password-strength rule
}

/**
 * @param {{ fullName: string, email: string, specialty: string, prcLicenseNumber: string, city: string,
 *   consultationFee: string | number }} form  the fee as typed; lib/fee.js decides whether it can be saved
 * @param {string} adminUid
 * @returns {Promise<string>} the new doctor's Auth uid
 */
export async function addProvider(form, adminUid) {
  const feeError = feeProblem(form.consultationFee)
  if (feeError) throw new Error(feeError)

  const scratchApp = initializeApp(firebaseConfig, `provision-${Date.now()}`)
  const scratchAuth = getAuth(scratchApp)
  const scratchDb = getFirestore(scratchApp)
  if (usingEmulators) {
    connectAuthEmulator(scratchAuth, 'http://127.0.0.1:9099', { disableWarnings: true })
    connectFirestoreEmulator(scratchDb, '127.0.0.1', 8080)
  }

  let uid = null
  try {
    const credential = await createUserWithEmailAndPassword(scratchAuth, form.email.trim(), randomPassword())
    uid = credential.user.uid

    // Same shape mobile/onboarding/professional-info.tsx writes when a doctor signs themselves up, plus
    // is_active (defaults true in the rules) and created_by_admin for the audit trail. One batch: both or neither.
    const batch = writeBatch(scratchDb)
    batch.set(doc(scratchDb, 'Users', uid), {
      full_name: form.fullName.trim(),
      email: form.email.trim(),
      role: 'doctor',
      is_active: true,
      onboarding_completed: true,
      created_at: serverTimestamp(),
    })
    batch.set(doc(scratchDb, 'Providers', uid), {
      full_name: form.fullName.trim(),
      specialty: form.specialty,
      prc_license_number: form.prcLicenseNumber.trim(),
      city: form.city.trim(),
      consultation_fee: storedFee(form.consultationFee),
      is_verified: false,
      is_active: true,
      created_at: serverTimestamp(),
    })
    await batch.commit()

    await signOut(scratchAuth)
  } catch (error) {
    if (uid) {
      // Best effort: an Auth user with no Firestore docs behind it would be an orphan login nobody can find.
      try { await scratchAuth.currentUser?.delete() } catch { /* ignored: the account may already be gone */ }
    }
    throw error
  } finally {
    await deleteApp(scratchApp)
  }

  // Back on the primary app, as the signed-in admin: mark who created and verified this profile (the rules
  // allow an admin to set created_by_admin only the first time), then email the doctor a reset link.
  await updateDoc(doc(db, 'Providers', uid), {
    is_verified: true,
    verified_by: adminUid,
    created_by_admin: adminUid,
  })
  await sendPasswordResetEmail(auth, form.email.trim())

  return uid
}
