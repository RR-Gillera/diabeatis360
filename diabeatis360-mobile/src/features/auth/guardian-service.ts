import { doc, onSnapshot, serverTimestamp, setDoc, Timestamp } from 'firebase/firestore';
import { getDownloadURL, list, ref, uploadBytes } from 'firebase/storage';

import { db, storage } from '@/firebase';
import type { GuardianRelationship } from '@/constants/enums';
import { FEATURE_UNAVAILABLE_TITLE, isStorageMissing } from '@/lib/feature-unavailable';

/**
 * Pediatric accounts under guardian supervision (DECISIONS.md D16; manuscript Scope & Limitations, UT-005).
 * One `Guardian_Verifications/{childUid}` document per child — there is no separate guardian login, the
 * guardian just fills this in once on the child's own account, which is what the manuscript's data
 * dictionary means by "Minor's Own User ID".
 */
export type GuardianVerification = {
  status: 'pending' | 'approved' | 'rejected';
  guardianFullName: string;
  relationship: GuardianRelationship;
  photoUrl: string;
  rejectionReason: string;
  submittedAt: Date | null;
};

/** Shown when the ID photo cannot be stored because Cloud Storage is not set up yet (the Firebase project is not on the Blaze plan). */
export const GUARDIAN_UPLOAD_UNAVAILABLE =
  `${FEATURE_UNAVAILABLE_TITLE}. A child's account needs the guardian's ID photo, and photo upload is still being set up. Please check back soon.`;

/**
 * Asks Cloud Storage whether it exists, without saving anything. Choosing "For my child" is permanent (firestore.rules:
 * account_type is set once) and a child's account cannot be verified without the ID photo, so the app checks this
 * BEFORE that choice is saved, instead of letting someone lock in a child's account that can never be verified.
 * Listing a folder the rules do not let us list answers 403 ("forbidden") when the bucket exists and 404 ("not
 * found") when it does not, so no real file is needed. Only a clear "not found" says no: being offline, slow or any
 * other answer counts as available, so nobody is blocked on a guess.
 */
export async function isGuardianPhotoStorageAvailable(): Promise<boolean> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const timeout = new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error('timeout')), 8000); });
    await Promise.race([list(ref(storage, 'guardian_ids'), { maxResults: 1 }), timeout]);
    return true;
  } catch (error) {
    return !isStorageMissing(error);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Uploads the guardian's ID photo (its local `file://` URI, as `expo-camera` returns it) to a path only the
 * child's own account and admins can read (storage.rules).
 *
 * Two React Native quirks ruled out the more obvious approaches:
 *  - `uploadString(ref, base64, 'base64')` fails with "Creating blobs from 'ArrayBuffer' and 'ArrayBufferView'
 *    are not supported": the web SDK builds a Blob from raw bytes internally, and RN's polyfilled Blob cannot
 *    be constructed that way.
 *  - `fetch('data:...')` also fails ("unknown protocol: data"): RN's native networking only fetches
 *    http(s):// and file:// URIs.
 * Fetching the camera's own local `file://` URI, on the other hand, is the documented, working pattern: RN's
 * fetch has special handling for local files that produces a real, uploadable Blob.
 */
async function uploadGuardianId(uid: string, localUri: string): Promise<string> {
  const photoRef = ref(storage, `guardian_ids/${uid}/id.jpg`);
  const blob = await (await fetch(localUri)).blob();
  await uploadBytes(photoRef, blob, { contentType: 'image/jpeg' });
  return getDownloadURL(photoRef);
}

/**
 * Submits (or resubmits after a rejection) the guardian verification for the signed-in child's own account.
 * A single `setDoc(..., { merge: true })` covers both cases: firestore.rules picks `allow create` the first
 * time and `allow update` on a resubmission, based on whether the document already exists.
 */
export async function submitGuardianVerification(
  uid: string,
  guardianFullName: string,
  relationship: GuardianRelationship,
  photoUri: string,
) {
  let photoUrl: string;
  try {
    photoUrl = await uploadGuardianId(uid, photoUri);
  } catch (error) {
    // "Not available yet" when Storage does not exist; otherwise a short plain message (with Firebase's error code,
    // which helps the team during testing) instead of Firebase's long wording.
    if (isStorageMissing(error)) throw new Error(GUARDIAN_UPLOAD_UNAVAILABLE);
    const code = typeof error === 'object' && error && 'code' in error ? ` (${String((error as { code: unknown }).code)})` : '';
    throw new Error(`We could not upload the ID photo${code}. Please check your connection and try again.`);
  }
  await setDoc(doc(db, 'Guardian_Verifications', uid), {
    user_id: uid,
    guardian_full_name: guardianFullName.trim(),
    relationship_to_minor: relationship,
    guardian_id_photo_url: photoUrl,
    verification_status: 'pending',
    submitted_at: serverTimestamp(),
  }, { merge: true });
}

export function subscribeToGuardianVerification(
  uid: string,
  onChange: (verification: GuardianVerification | null) => void,
  onError: (error: Error) => void,
) {
  return onSnapshot(
    doc(db, 'Guardian_Verifications', uid),
    (snapshot) => {
      if (!snapshot.exists()) { onChange(null); return; }
      const data = snapshot.data();
      onChange({
        status: (data.verification_status === 'approved' || data.verification_status === 'rejected') ? data.verification_status : 'pending',
        guardianFullName: String(data.guardian_full_name ?? ''),
        relationship: (data.relationship_to_minor ?? 'parent') as GuardianRelationship,
        photoUrl: String(data.guardian_id_photo_url ?? ''),
        rejectionReason: String(data.rejection_reason ?? ''),
        submittedAt: (data.submitted_at as Timestamp | undefined)?.toDate?.() ?? null,
      });
    },
    (error) => onError(error),
  );
}
