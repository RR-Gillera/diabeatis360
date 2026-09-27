import { doc, onSnapshot, serverTimestamp, setDoc, Timestamp } from 'firebase/firestore';
import { getDownloadURL, ref, uploadString } from 'firebase/storage';

import { db, storage } from '@/firebase';
import type { GuardianRelationship } from '@/constants/enums';

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

/** Uploads the guardian's ID photo to a path only the child's own account and admins can read (storage.rules). */
async function uploadGuardianId(uid: string, base64: string): Promise<string> {
  const photoRef = ref(storage, `guardian_ids/${uid}/id.jpg`);
  await uploadString(photoRef, base64, 'base64', { contentType: 'image/jpeg' });
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
  photoBase64: string,
) {
  const photoUrl = await uploadGuardianId(uid, photoBase64);
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
